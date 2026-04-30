(() => {
  // If already loaded, just show the bar and bail
  if (window.__srLoaded) {
    const bar = document.getElementById('sr-bar');
    if (bar) bar.style.display = 'flex';
    return;
  }
  window.__srLoaded = true;

  // Pre-compute the teleprompter URL now, while the extension context is
  // guaranteed valid (we were just injected). Storing it as a plain string
  // means openTpPopup never needs to call chrome.runtime.getURL() later —
  // no risk of "Extension context invalidated" from a Chrome API call.
  let _tpUrl = null;
  try { _tpUrl = chrome.runtime.getURL('teleprompter.html'); } catch {}

  // Returns false when the extension has been reloaded/disabled mid-session
  function ctxOk() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; }
  }

  // ─── State ───────────────────────────────────────────────────────────────
  const state = {
    recording: false,
    paused: false,
    drawing: false,
    drawInterval: null,
    mediaRecorder: null,
    chunks: [],
    screenStream: null,
    webcamStream: null,
    screenVid: null,
    camVid: null,       // offscreen video for canvas — not tied to the DOM bubble
    pipVid: null,       // video element used for Picture-in-Picture face preview
    audioCtx: null,
    timerInterval: null,
    seconds: 0,
    recStartTime: 0,      // Date.now() when MediaRecorder actually started
    fadeIn: 1,            // 0→1 at recording start (drives black overlay)
    isFadingOut: false,   // true while stop fade is running
    fadeOut: 0,           // 0→1 at recording end
    cursorX: 0,           // page cursor position for spotlight
    cursorY: 0,
    screenDrawRect: null, // {dx,dy,dw,dh} set by active template for cursor mapping
    source: 'tab',        // 'tab' | 'any' — set at record time
    countdown: 0,         // 3/2/1 during countdown, 0 otherwise
    _finalized: false,    // guard against double finalizeStop calls
    tp: {
      text: '',
      size: 36,
      speed: 50,
      popup: null,
      _listenerAdded: false,
    },
  };

  // ─── Styles ───────────────────────────────────────────────────────────────
  const CSS = `
    #sr-bar, #sr-webcam, #sr-toast {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-sizing: border-box;
    }
    #sr-bar *, #sr-webcam * {
      all: unset;
      box-sizing: border-box;
    }

    /* ── Control bar ── */
    #sr-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(12, 12, 12, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 999px;
      padding: 10px 18px;
      z-index: 2147483647;
      box-shadow: 0 8px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset;
      color: #fff;
      user-select: none;
      white-space: nowrap;
      cursor: grab;
    }
    #sr-bar.dragging { cursor: grabbing; }

    #sr-dot {
      display: block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #555;
      flex-shrink: 0;
      transition: background 0.3s;
    }
    #sr-dot.on {
      background: #ff3b30;
      animation: sr-pulse 1.4s ease-in-out infinite;
    }
    #sr-dot.paused {
      background: #ff9f0a;
      animation: none;
    }
    @keyframes sr-pulse {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.35; }
    }

    #sr-timer {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: rgba(255,255,255,0.85);
      min-width: 38px;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    /* ── Mini webcam preview in bar ── */
    #sr-cam-mini {
      display: none;
      width: 72px;
      height: 72px;
      border-radius: 10px;
      overflow: hidden;
      border: 2px solid rgba(255,59,48,0.85);
      flex-shrink: 0;
      box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    }
    #sr-cam-mini.active { display: block; }
    #sr-cam-mini video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    #sr-source {
      background: rgba(255,255,255,0.08);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
      padding-right: 24px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.5)'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      transition: background 0.2s;
    }
    #sr-source:hover { background-color: rgba(255,255,255,0.14); }
    #sr-source option { background: #1c1c1e; color: #fff; }

    /* ── Format picker ── */
    #sr-format-pick {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sr-fmt-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 8px 18px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1.5px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.07);
      color: #fff;
      transition: all 0.15s;
      line-height: 1;
    }
    .sr-fmt-btn:active { transform: scale(0.96); }
    .sr-fmt-btn.youtube:hover { background: rgba(255,30,30,0.18); border-color: rgba(255,60,60,0.5); }
    .sr-fmt-btn.reel:hover    { background: rgba(130,80,255,0.18); border-color: rgba(160,100,255,0.5); }

    /* ── Recording controls (shown after format is chosen) ── */
    #sr-controls {
      display: none;
      align-items: center;
      gap: 10px;
    }
    #sr-controls.active { display: flex; }

    .sr-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      border-radius: 999px;
      padding: 7px 15px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.15s, opacity 0.15s;
      border: none;
      outline: none;
      line-height: 1;
    }
    .sr-btn:active { transform: scale(0.96); }

    #sr-rec-btn {
      background: #ff3b30;
      color: #fff;
    }
    #sr-rec-btn:hover { opacity: 0.85; }

    #sr-stop-btn {
      background: rgba(255,255,255,0.12);
      color: #fff;
      display: none;
    }
    #sr-stop-btn:hover { background: rgba(255,255,255,0.2); }

    #sr-pause-btn {
      background: rgba(255,255,255,0.1);
      color: #fff;
      display: none;
    }
    #sr-pause-btn:hover { background: rgba(255,255,255,0.2); }
    #sr-pause-btn.resumed { background: rgba(255, 159, 10, 0.25); color: #ff9f0a; }

    #sr-close-btn {
      background: transparent;
      color: rgba(255,255,255,0.38);
      padding: 7px 9px;
      font-size: 15px;
    }
    #sr-close-btn:hover { color: rgba(255,255,255,0.8); }

    /* ── Webcam bubble ── */
    #sr-webcam {
      display: none;
      position: fixed;
      bottom: 28px;
      left: 28px;
      width: 156px;
      height: 156px;
      border-radius: 50%;
      overflow: hidden;
      z-index: 2147483646;
      cursor: grab;
      box-shadow:
        0 0 0 3px rgba(255, 59, 48, 0.75),
        0 6px 28px rgba(0,0,0,0.6);
      background: #111;
    }
    #sr-webcam.active { display: block; }
    #sr-webcam.dragging { cursor: grabbing; }

    #sr-webcam video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    /* ── Countdown overlay ── */
    #sr-countdown {
      position: fixed;
      inset: 0;
      z-index: 2147483648;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.72);
      font-size: 200px;
      font-weight: 800;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      pointer-events: none;
      text-shadow: 0 0 100px rgba(255,255,255,0.25);
      letter-spacing: -0.02em;
    }

    /* ── Toast ── */
    #sr-toast {
      position: fixed;
      bottom: 90px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(30,30,30,0.95);
      color: #fff;
      font-size: 13px;
      font-family: -apple-system, sans-serif;
      padding: 9px 18px;
      border-radius: 999px;
      z-index: 2147483648;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
      border: 1px solid rgba(255,255,255,0.08);
    }
    #sr-toast.show { opacity: 1; }
  `;

  function injectStyles() {
    if (document.getElementById('sr-styles')) return;
    const s = document.createElement('style');
    s.id = 'sr-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ─── UI Construction ──────────────────────────────────────────────────────
  function buildUI() {
    if (document.getElementById('sr-bar')) {
      document.getElementById('sr-bar').style.display = 'flex';
      return;
    }

    injectStyles();

    // Control bar
    const bar = document.createElement('div');
    bar.id = 'sr-bar';
    bar.innerHTML = `
      <span id="sr-dot"></span>
      <span id="sr-timer">0:00</span>
      <div id="sr-format-pick">
        <button class="sr-fmt-btn youtube" id="sr-fmt-youtube">▶ YouTube</button>
        <button class="sr-fmt-btn reel"    id="sr-fmt-reel">↕ Reel</button>
      </div>
      <div id="sr-controls">
        <div id="sr-cam-mini"><video id="sr-cam-mini-vid" autoplay muted playsinline></video></div>
        <select id="sr-source">
          <option value="tab">This Tab</option>
          <option value="any">Screen / Window / Tab</option>
        </select>
        <button class="sr-btn" id="sr-tp-toggle" title="Teleprompter">&#9776; Script</button>
        <button class="sr-btn" id="sr-rec-btn">&#9679; Record</button>
        <button class="sr-btn" id="sr-pause-btn">&#9646;&#9646; Pause</button>
        <button class="sr-btn" id="sr-stop-btn">&#9632; Stop</button>
      </div>
      <button class="sr-btn" id="sr-close-btn">&#x2715;</button>
    `;
    document.body.appendChild(bar);

    // Webcam bubble
    const bubble = document.createElement('div');
    bubble.id = 'sr-webcam';
    const vid = document.createElement('video');
    vid.id = 'sr-cam-vid';
    vid.autoplay = true;
    vid.muted = true;
    vid.playsInline = true;
    bubble.appendChild(vid);
    document.body.appendChild(bubble);

    // Toast
    const toast = document.createElement('div');
    toast.id = 'sr-toast';
    document.body.appendChild(toast);

    // Teleprompter — opens as a proper extension page.
    // _tpUrl was pre-computed at inject time (guaranteed valid context), so this
    // function never needs to call any Chrome API — safe even after extension reload.
    function openTpPopup() {
      if (!_tpUrl) {
        showToast('Reload the page to use Script', 4000);
        return;
      }

      try {
        if (state.tp.popup && !state.tp.popup.closed) { state.tp.popup.focus(); return; }
      } catch { state.tp.popup = null; }

      const url = _tpUrl;

      const pw = Math.min(screen.width, 960), ph = 320;
      const pop = window.open(url, 'sr_teleprompter',
        `width=${pw},height=${ph},top=0,left=${Math.round((screen.width-pw)/2)},menubar=no,toolbar=no,scrollbars=no,resizable=yes`);
      if (!pop) { showToast('Allow popups for teleprompter', 4000); return; }
      state.tp.popup = pop;

      if (!state.tp._listenerAdded) {
        state.tp._listenerAdded = true;
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'tp-settings') {
            state.tp.text  = e.data.text;
            state.tp.size  = e.data.size;
            state.tp.speed = e.data.speed;
          }
        });
      }
    }

    // Track cursor for spotlight effect
    document.addEventListener('mousemove', (e) => {
      state.cursorX = e.clientX;
      state.cursorY = e.clientY;
    });

    makeDraggable(bubble);
    makeDraggable(bar);

    // Format picker — sets template and reveals recording controls
    function selectFormat(tmpl) {
      if (window.SR_BRANDING) window.SR_BRANDING.template = tmpl;
      document.getElementById('sr-format-pick').style.display = 'none';
      document.getElementById('sr-controls').classList.add('active');
    }
    bar.querySelector('#sr-fmt-youtube').addEventListener('click', () => selectFormat('youtube'));
    bar.querySelector('#sr-fmt-reel').addEventListener('click',    () => selectFormat('reel'));

    bar.querySelector('#sr-tp-toggle').addEventListener('click', openTpPopup);

    bar.querySelector('#sr-rec-btn').addEventListener('click', startRecording);
    bar.querySelector('#sr-pause-btn').addEventListener('click', togglePause);
    bar.querySelector('#sr-stop-btn').addEventListener('click', stopRecording);
    bar.querySelector('#sr-close-btn').addEventListener('click', () => {
      if (!state.recording) {
        cleanupStreams();
        teardown();
      }
    });
  }

  // ─── Draggable ────────────────────────────────────────────────────────────
  function makeDraggable(el) {
    let drag = false, ox = 0, oy = 0, moved = false;

    el.addEventListener('mousedown', (e) => {
      if (['BUTTON', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;
      drag = true;
      moved = false;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      moved = true;
      el.classList.add('dragging');
      el.style.right  = 'auto';
      el.style.bottom = 'auto';
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top  = (e.clientY - oy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (drag) {
        drag = false;
        el.classList.remove('dragging');
      }
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  // Strong bookmark branding: animated lower-third — slides in at 2s, fades out at 8s
  function drawBranding(ctx, CW, CH, scrX, scrW, scrH, panY) {
    const b = window.SR_BRANDING;
    if (!b || !b.show) return;

    const name    = (b.name    || '').trim();
    const title   = (b.title   || '').trim();
    const company = (b.company || '').trim();
    const website = (b.website || '').trim();
    const accent  = b.accentColor || '#ff3b30';
    if (!name) return;

    // Animation: hidden → slide up + fade in (2-3s) → hold (3-8s) → fade out (8-9s) → hidden
    const elapsed = state.recStartTime ? (Date.now() - state.recStartTime) / 1000 : 0;
    let alpha = 0, slideY = 0;
    if      (elapsed < 2)  { return; }
    else if (elapsed < 3)  { const p = elapsed - 2; alpha = p;       slideY = (1 - p) * 32; }
    else if (elapsed < 8)  { alpha = 1; slideY = 0; }
    else if (elapsed < 9)  { alpha = Math.max(0, 1 - (elapsed - 8)); slideY = 0; }
    else                   { return; }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, slideY);

    const subtitle = [title, company].filter(Boolean).join('  ·  ');
    const fontFace = "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";

    const nameSize = Math.round(CH * 0.030);
    const subSize  = Math.round(CH * 0.020);
    const webSize  = Math.round(CH * 0.016);
    const padX     = Math.round(CH * 0.018);  // horizontal padding inside box
    const padY     = Math.round(CH * 0.014);  // vertical padding inside box
    const rowGap   = Math.round(CH * 0.008);
    const barW     = Math.round(CH * 0.006);  // vertical accent bar width
    const barGap   = Math.round(CH * 0.012);  // gap between bar and text
    const outerPad = Math.round(CH * 0.040);  // distance from panel edge

    // Measure text widths to size the box correctly
    ctx.save();
    ctx.font = `700 ${nameSize}px ${fontFace}`;
    const nameW = ctx.measureText(name).width;
    ctx.font = `300 ${subSize}px ${fontFace}`;
    const subW = subtitle ? ctx.measureText(subtitle).width : 0;
    ctx.font = `500 ${webSize}px ${fontFace}`;
    const webW = website ? ctx.measureText(website).width : 0;
    ctx.restore();

    const maxTextW = Math.max(nameW, subW, webW);
    const boxW = padX + barW + barGap + maxTextW + padX;
    let boxH = padY + nameSize;
    if (subtitle) boxH += rowGap + subSize;
    if (website)  boxH += rowGap + webSize;
    boxH += padY;

    // Position: bottom-right of screen panel
    const boxX = scrX + scrW - outerPad - boxW;
    const boxY = panY + scrH - outerPad - boxH;

    // Corner vignette for legibility
    const panRadius = Math.round(CH * 0.045);
    ctx.save();
    rrect(ctx, scrX, panY, scrW, scrH, panRadius);
    ctx.clip();
    const vg = ctx.createRadialGradient(
      scrX + scrW, panY + scrH, 0,
      scrX + scrW, panY + scrH, scrW * 0.55
    );
    vg.addColorStop(0,   'rgba(0,0,0,0.60)');
    vg.addColorStop(0.5, 'rgba(0,0,0,0.22)');
    vg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(scrX, panY, scrW, scrH);
    ctx.restore();

    ctx.save();

    // Dark semi-transparent background box with rounded corners
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fill();

    // Vertical accent bar — left edge of box, inset by padX
    ctx.fillStyle = accent;
    ctx.fillRect(boxX + padX, boxY + padY, barW, boxH - padY * 2);

    // Text — left-aligned, top baseline — no strikethrough artifacts
    const textX = boxX + padX + barW + barGap;
    let textY   = boxY + padY;

    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor  = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur   = 8;

    ctx.font      = `700 ${nameSize}px ${fontFace}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, textX, textY);
    textY += nameSize + rowGap;

    if (subtitle) {
      ctx.font      = `300 ${subSize}px ${fontFace}`;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(subtitle, textX, textY);
      textY += subSize + rowGap;
    }

    if (website) {
      ctx.font      = `500 ${webSize}px ${fontFace}`;
      ctx.fillStyle = accent;
      ctx.fillText(website, textX, textY);
    }

    ctx.restore(); // inner save (text drawing)
    ctx.restore(); // outer save (animation alpha + translate)
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ─── Teleprompter ────────────────────────────────────────────────────────
  function startTeleprompter() {
    const tp = state.tp;
    if (!tp.popup || tp.popup.closed) {
      // Popup was never opened or user closed it — teleprompter is optional, silently skip
      return;
    }
    tp.popup.postMessage({ cmd: 'start', text: tp.text, size: tp.size, speed: tp.speed }, '*');
    try { tp.popup.focus(); } catch {}
    console.log('SR: teleprompter started, text length:', tp.text?.length, 'speed:', tp.speed);
  }

  function stopTeleprompter() {
    const tp = state.tp;
    if (tp.popup && !tp.popup.closed) {
      tp.popup.postMessage({ cmd: 'stop' }, '*');
    }
  }

  // ─── Recording ───────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      // 1. Camera + mic — request separately so one failing doesn't kill the other.
      //    Must happen before getDisplayMedia while user gesture is still live (for PiP).
      let camStream = null, micStream = null;
      try {
        camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
        });
      } catch (err) {
        const why = err.name === 'NotAllowedError'
          ? 'Camera denied — click 🔒 in the address bar to allow'
          : 'Camera not available: ' + err.message;
        showToast(why, 5000);
        console.warn('SR: camera failed:', err.name);
      }
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const why = err.name === 'NotAllowedError'
          ? 'Mic denied — click 🔒 in the address bar to allow'
          : 'Mic not available: ' + err.message;
        showToast(why, 5000);
        console.warn('SR: mic failed:', err.name);
      }

      // Combine into one stream so the rest of the code has a single handle
      if (camStream || micStream) {
        const tracks = [
          ...(camStream  ? camStream.getVideoTracks()  : []),
          ...(micStream  ? micStream.getAudioTracks()  : []),
        ];
        state.webcamStream = new MediaStream(tracks);
      }

      // 2. Face preview — PiP if the site allows it, otherwise webcam bubble fallback
      //    Reel template composites the camera on-canvas, so skip the overlay entirely.
      const hasCamVideo = state.webcamStream && state.webcamStream.getVideoTracks().length > 0;
      const _activeTemplate = (window.SR_BRANDING && window.SR_BRANDING.template) || 'youtube';
      if (hasCamVideo && _activeTemplate !== 'reel') {
        let pipOk = false;
        if (document.pictureInPictureEnabled) {
          try {
            state.pipVid = document.createElement('video');
            state.pipVid.srcObject = state.webcamStream;
            state.pipVid.muted = true;
            Object.assign(state.pipVid.style, {
              position: 'fixed', top: '0', left: '0',
              width: '1px', height: '1px', pointerEvents: 'none',
            });
            document.body.appendChild(state.pipVid);
            await state.pipVid.play();
            await state.pipVid.requestPictureInPicture();
            pipOk = true;
          } catch {
            state.pipVid?.remove();
            state.pipVid = null;
          }
        }
        if (!pipOk) {
          // Fallback: floating bubble — note it may appear in tab recordings
          const camVidEl = document.getElementById('sr-cam-vid');
          if (camVidEl) camVidEl.srcObject = state.webcamStream;
          document.getElementById('sr-webcam')?.classList.add('active');
          showToast('PiP blocked by site — face preview may appear in recording', 4000);
        }
      }

      // 3. Screen capture
      const source = document.getElementById('sr-source')?.value ?? 'tab';
      state.source = source;
      const displayOptions = {
        video: { cursor: 'always', frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: false, noiseSuppression: false },
      };
      if (source === 'tab') {
        displayOptions.preferCurrentTab = true;
        showToast('Click Share to record this tab', 5000);
      }
      state.screenStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);

      // 4. Offscreen webcam video for canvas compositing (only if camera has video tracks)
      const miniVid = document.getElementById('sr-cam-mini-vid');
      if (hasCamVideo) {
        miniVid.srcObject = state.webcamStream;
        document.getElementById('sr-cam-mini').classList.add('active');

        state.camVid = document.createElement('video');
        state.camVid.srcObject = new MediaStream(state.webcamStream.getVideoTracks());
        state.camVid.muted = true;
        await state.camVid.play();
      }

      // 4. Canvas compositing — dimensions driven by the selected template
      const screenTrack = state.screenStream.getVideoTracks()[0];

      const tmplKey0 = (window.SR_BRANDING && window.SR_BRANDING.template) || 'youtube';
      const tmpl0    = (window.SR_TEMPLATES || {})[tmplKey0] || {};
      const CW = tmpl0.width  || 1920;
      const CH = tmpl0.height || 1080;
      const canvas = document.createElement('canvas');
      canvas.width  = CW;
      canvas.height = CH;
      const ctx2d = canvas.getContext('2d');

      state.screenVid = document.createElement('video');
      state.screenVid.srcObject = new MediaStream([screenTrack]);
      state.screenVid.muted = true;
      await state.screenVid.play();

      // setInterval instead of requestAnimationFrame — rAF stops when tab loses
      // focus (e.g. during screen-share dialog), causing the recording to freeze.
      state.drawing = true;
      state.drawInterval = setInterval(() => {
        if (!state.drawing) return;
        try {
          // ── Template draw ──────────────────────────────────────────
          const tmplKey = (window.SR_BRANDING && window.SR_BRANDING.template) || 'youtube';
          const tmpls   = window.SR_TEMPLATES || {};
          const tmpl    = tmpls[tmplKey] || tmpls['youtube'];
          if (tmpl) {
            state.screenDrawRect = null;
            tmpl.draw({
              ctx: ctx2d, CW, CH,
              screenVid: state.screenVid, camVid: state.camVid,
              rrect, drawBranding,
              elapsed: state.recStartTime ? (Date.now() - state.recStartTime) / 1000 : 0,
              setScreenBounds: (r) => { state.screenDrawRect = r; },
            });
          }

          // ── Post-processing ────────────────────────────────────────

          // 1. Cinematic color grade: vignette + warm tint
          const vign = ctx2d.createRadialGradient(CW/2, CH/2, CH * 0.22, CW/2, CH/2, CW * 0.70);
          vign.addColorStop(0, 'rgba(0,0,0,0)');
          vign.addColorStop(1, 'rgba(0,0,0,0.42)');
          ctx2d.fillStyle = vign;
          ctx2d.fillRect(0, 0, CW, CH);
          ctx2d.fillStyle = 'rgba(255,120,10,0.032)';  // subtle warm tint
          ctx2d.fillRect(0, 0, CW, CH);

          // 2. Cursor spotlight — tab mode only, uses template-set screen bounds
          if (state.source === 'tab' && state.screenDrawRect) {
            const { dx, dy, dw, dh } = state.screenDrawRect;
            const sx = dx + (state.cursorX / window.innerWidth)  * dw;
            const sy = dy + (state.cursorY / window.innerHeight) * dh;
            const glow = ctx2d.createRadialGradient(sx, sy, 0, sx, sy, CH * 0.10);
            glow.addColorStop(0,   'rgba(255,255,255,0.11)');
            glow.addColorStop(0.5, 'rgba(255,255,255,0.03)');
            glow.addColorStop(1,   'rgba(0,0,0,0)');
            ctx2d.fillStyle = glow;
            ctx2d.fillRect(0, 0, CW, CH);
          }

          // 3. Countdown overlay (before MediaRecorder starts — not in recording)
          if (state.countdown > 0) {
            ctx2d.fillStyle = 'rgba(0,0,0,0.6)';
            ctx2d.fillRect(0, 0, CW, CH);
            ctx2d.save();
            ctx2d.font = `800 ${Math.round(CH * 0.22)}px -apple-system, sans-serif`;
            ctx2d.fillStyle = '#ffffff';
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'middle';
            ctx2d.shadowColor = 'rgba(255,255,255,0.25)';
            ctx2d.shadowBlur = 60;
            ctx2d.fillText(state.countdown, CW / 2, CH / 2);
            ctx2d.restore();
          }

          // 4. Fade-in from black at recording start (~2s)
          if (state.fadeIn < 1) {
            state.fadeIn = Math.min(1, state.fadeIn + 1 / 120);
            ctx2d.fillStyle = `rgba(0,0,0,${1 - state.fadeIn})`;
            ctx2d.fillRect(0, 0, CW, CH);
          }

          // 5. Fade-out to black when stopping (~2s)
          if (state.isFadingOut) {
            state.fadeOut = Math.min(1, state.fadeOut + 1 / 120);
            ctx2d.fillStyle = `rgba(0,0,0,${state.fadeOut})`;
            ctx2d.fillRect(0, 0, CW, CH);
            if (state.fadeOut >= 1) {
              state.isFadingOut = false;
              // Stop MediaRecorder before cleanupStreams (which kills this interval)
              if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
                state.mediaRecorder.stop();
              }
              setTimeout(finalizeStop, 50); // slight delay so last chunk is flushed
            }
          }

        } catch (e) { console.warn('SR draw error:', e); }
      }, 1000 / 60); // 60 fps — runs even when tab is not focused

      // 5. Mix audio: screen + mic
      state.audioCtx = new AudioContext();
      const dest = state.audioCtx.createMediaStreamDestination();
      const screenAudio = state.screenStream.getAudioTracks();
      if (screenAudio.length) {
        state.audioCtx.createMediaStreamSource(new MediaStream(screenAudio)).connect(dest);
      }
      if (state.webcamStream) {
        const micAudio = state.webcamStream.getAudioTracks();
        if (micAudio.length) {
          state.audioCtx.createMediaStreamSource(new MediaStream(micAudio)).connect(dest);
        }
      }

      // 6. Combined: composited canvas video + mixed audio
      const combined = new MediaStream([
        ...canvas.captureStream(60).getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // 7. MediaRecorder — create but don't start yet (countdown first)
      const mimeType = pickMimeType();
      state.mediaRecorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 12_000_000,
        audioBitsPerSecond:    192_000,
      });
      state.chunks = [];
      state.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
      state.mediaRecorder.onstop  = saveFile;
      state.mediaRecorder.onerror = (e) => {
        console.error('SR: MediaRecorder error:', e.error);
        showToast('Recorder error: ' + e.error?.message, 5000);
      };
      state.mediaRecorder.onstop = () => { console.log('SR: MediaRecorder stopped'); saveFile(); };

      screenTrack.addEventListener('ended', () => {
        console.log('SR: screenTrack ended — stopping recording');
        stopRecording();
      });

      // 8. Hide bar now (before countdown) so it's not visible
      document.getElementById('sr-dot').classList.add('on');
      document.getElementById('sr-source').style.display    = 'none';
      document.getElementById('sr-rec-btn').style.display   = 'none';
      document.getElementById('sr-pause-btn').style.display = 'inline-flex';
      document.getElementById('sr-stop-btn').style.display  = 'inline-flex';
      document.getElementById('sr-bar').style.display = 'none';

      // 9. Countdown 3-2-1 (DOM overlay + canvas, not recorded)
      const cdEl = document.createElement('div');
      cdEl.id = 'sr-countdown';
      document.body.appendChild(cdEl);
      for (let i = 3; i >= 1; i--) {
        state.countdown = i;
        cdEl.textContent = i;
        await new Promise(r => setTimeout(r, 1000));
      }
      state.countdown = 0;
      cdEl.remove();

      // 10. Start recording — fade in begins from first frame
      state.fadeIn = 0;
      state.fadeOut = 0;
      state.isFadingOut = false;
      state._finalized = false;
      startTeleprompter();
      state.mediaRecorder.start(1000);
      state.recording = true;
      state.recStartTime = Date.now();

      // 11. Timer
      state.seconds = 0;
      updateTimer();
      state.timerInterval = setInterval(() => {
        state.seconds++;
        try { updateTimer(); } catch {}
      }, 1000);

    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        showToast('Recording failed: ' + err.message, 4000);
      }
      cleanupStreams();
    }
  }

  function togglePause() {
    if (!state.recording || !state.mediaRecorder) return;
    const btn = document.getElementById('sr-pause-btn');
    const dot = document.getElementById('sr-dot');

    if (!state.paused) {
      state.mediaRecorder.pause();
      state.paused = true;
      clearInterval(state.timerInterval);
      dot.classList.remove('on');
      dot.classList.add('paused');
      btn.innerHTML = '&#9654; Resume';
      btn.classList.add('resumed');
    } else {
      state.mediaRecorder.resume();
      state.paused = false;
      state.timerInterval = setInterval(() => {
        state.seconds++;
        try { updateTimer(); } catch {}
      }, 1000);
      dot.classList.remove('paused');
      dot.classList.add('on');
      btn.innerHTML = '&#9646;&#9646; Pause';
      btn.classList.remove('resumed');
    }
  }

  function stopRecording() {
    if (!state.recording) return;
    console.log('SR: stopRecording', new Error().stack);
    clearInterval(state.timerInterval);
    state.recording = false;
    state.paused = false;
    state.isFadingOut = true;
    state.fadeOut = 0;
    // Safety net: finalizeStop after 3s in case draw loop doesn't complete fade
    setTimeout(() => {
      if (state.isFadingOut) {
        state.isFadingOut = false;
        finalizeStop();
      }
    }, 3000);
  }

  function finalizeStop() {
    if (state._finalized) return;
    state._finalized = true;
    // MediaRecorder.stop() already called by draw loop (or safety timeout does it here)
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();
    }
    cleanupStreams();
    state._finalized = false;

    // Reset UI — return to format picker
    document.getElementById('sr-bar').style.display            = 'flex';
    document.getElementById('sr-format-pick').style.display    = 'flex';
    document.getElementById('sr-controls').classList.remove('active');
    document.getElementById('sr-dot').classList.remove('on');
    document.getElementById('sr-dot').classList.remove('paused');
    document.getElementById('sr-cam-mini').classList.remove('active');
    document.getElementById('sr-rec-btn').style.display   = '';
    document.getElementById('sr-source').style.display    = '';
    document.getElementById('sr-pause-btn').style.display = 'none';
    document.getElementById('sr-pause-btn').classList.remove('resumed');
    document.getElementById('sr-pause-btn').innerHTML = '&#9646;&#9646; Pause';
    document.getElementById('sr-stop-btn').style.display  = 'none';
    document.getElementById('sr-webcam')?.classList.remove('active');
    const bubble = document.getElementById('sr-webcam');
    if (bubble) {
      bubble.style.left = '28px'; bubble.style.top = '';
      bubble.style.right = ''; bubble.style.bottom = '28px';
    }
    document.getElementById('sr-timer').textContent = '0:00';
    document.getElementById('sr-countdown')?.remove();
  }

  function cleanupStreams() {
    stopTeleprompter();
    state.drawing = false;
    clearInterval(state.drawInterval);
    state.drawInterval = null;
    state.screenVid?.pause();
    state.screenVid = null;
    state.camVid?.pause();
    state.camVid = null;
    // Exit Picture-in-Picture face preview
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    state.pipVid?.remove();
    state.pipVid = null;
    state.screenStream?.getTracks().forEach(t => t.stop());
    state.webcamStream?.getTracks().forEach(t => t.stop());
    state.audioCtx?.close().catch(() => {});
    state.screenStream = null;
    state.webcamStream = null;
    state.audioCtx = null;
  }

  function saveFile() {
    if (!state.chunks.length) {
      showToast('Nothing recorded — try again', 4000);
      return;
    }

    const mimeType = state.mediaRecorder?.mimeType || 'video/webm';
    const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(state.chunks, { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const ts   = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

    const a = document.createElement('a');
    a.href     = url;
    a.download = `recording-${ts}.${ext}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 10000);

    const fmt = mimeType.includes('mp4') ? 'MP4' : 'WebM';
    showToast(`Saved as ${fmt} — check Downloads`, 4000);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function updateTimer() {
    const el = document.getElementById('sr-timer');
    if (!el) return;
    const m = Math.floor(state.seconds / 60);
    const s = state.seconds % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  function pickMimeType() {
    const candidates = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc3.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc3,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    // Log all support results so we can diagnose
    candidates.forEach(t => console.log('SR isTypeSupported:', t, '→', MediaRecorder.isTypeSupported(t)));
    const chosen = candidates.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
    console.log('SR: chosen format:', chosen);
    return chosen;
  }

  let toastTimer = null;
  function showToast(msg, duration = 2500) {
    const t = document.getElementById('sr-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), duration);
  }

  function teardown() {
    stopTeleprompter();
    document.getElementById('sr-bar')?.remove();
    document.getElementById('sr-webcam')?.remove();
    document.getElementById('sr-toast')?.remove();
    document.getElementById('sr-countdown')?.remove();
    stopTeleprompter();
    if (state.tp.popup && !state.tp.popup.closed) state.tp.popup.close();
    document.getElementById('sr-styles')?.remove();
    window.__srLoaded = false;
  }

  // ─── Entry point ─────────────────────────────────────────────────────────
  buildUI();

})();
