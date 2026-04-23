(() => {
  // If already loaded, just show the bar and bail
  if (window.__srLoaded) {
    const bar = document.getElementById('sr-bar');
    if (bar) bar.style.display = 'flex';
    return;
  }
  window.__srLoaded = true;

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
      <div id="sr-cam-mini"><video id="sr-cam-mini-vid" autoplay muted playsinline></video></div>
      <select id="sr-source">
        <option value="tab">This Tab</option>
        <option value="any">Screen / Window / Tab</option>
      </select>
      <button class="sr-btn" id="sr-rec-btn">&#9679; Record</button>
      <button class="sr-btn" id="sr-pause-btn">&#9646;&#9646; Pause</button>
      <button class="sr-btn" id="sr-stop-btn">&#9632; Stop</button>
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

    makeDraggable(bubble);
    makeDraggable(bar);

    bar.querySelector('#sr-rec-btn').addEventListener('click', startRecording);
    bar.querySelector('#sr-pause-btn').addEventListener('click', togglePause);
    bar.querySelector('#sr-stop-btn').addEventListener('click', stopRecording);
    bar.querySelector('#sr-close-btn').addEventListener('click', () => {
      if (!state.recording) teardown();
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
  // Strong bookmark branding: dark box + vertical accent bar + stacked text
  function drawBranding(ctx, CW, CH, scrX, scrW, scrH, panY) {
    const b = window.SR_BRANDING;
    if (!b || !b.show) return;

    const name    = (b.name    || '').trim();
    const title   = (b.title   || '').trim();
    const company = (b.company || '').trim();
    const website = (b.website || '').trim();
    const accent  = b.accentColor || '#ff3b30';
    if (!name) return;

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

    ctx.restore();
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

  // ─── Recording ───────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      // 1. Screen capture
      const source = document.getElementById('sr-source')?.value ?? 'tab';
      const displayOptions = {
        video: { cursor: 'always', frameRate: { ideal: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: false, noiseSuppression: false },
      };
      if (source === 'tab') {
        displayOptions.preferCurrentTab = true;
        showToast('Click Share to record this tab', 5000);
      }
      state.screenStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);

      // 2. Webcam + mic (optional)
      try {
        state.webcamStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
          audio: true,
        });
      } catch {
        console.warn('Screen Recorder: webcam/mic not available');
      }

      // 3. Webcam preview — mini bar thumbnail only (bubble stays hidden so it
      //    doesn't appear in the screen capture). A separate offscreen video
      //    element is used for canvas drawing so display:none doesn't block it.
      const miniVid = document.getElementById('sr-cam-mini-vid');
      if (state.webcamStream) {
        // Mini bar preview (visible to user for framing)
        miniVid.srcObject = state.webcamStream;
        document.getElementById('sr-cam-mini').classList.add('active');

        // Offscreen video for canvas — must be played explicitly, not via autoplay
        state.camVid = document.createElement('video');
        state.camVid.srcObject = state.webcamStream;
        state.camVid.muted = true;
        await state.camVid.play();
      }

      // 4. Canvas compositing — Loom-style side-by-side layout
      const screenTrack = state.screenStream.getVideoTracks()[0];

      const CW = 1920, CH = 1080;
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
          const tmplKey = (window.SR_BRANDING && window.SR_BRANDING.template) || 'side-by-side';
          const tmpls   = window.SR_TEMPLATES || {};
          const tmpl    = tmpls[tmplKey] || tmpls['side-by-side'];
          if (tmpl) {
            tmpl.draw({ ctx: ctx2d, CW, CH, screenVid: state.screenVid, camVid: state.camVid, rrect, drawBranding });
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

      // 7. MediaRecorder
      const mimeType = pickMimeType();
      state.mediaRecorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 12_000_000,  // 12 Mbps — high clarity
        audioBitsPerSecond:    192_000,  // 192 kbps
      });
      state.chunks = [];
      state.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) state.chunks.push(e.data); };
      state.mediaRecorder.onstop  = saveFile;
      state.mediaRecorder.onerror = (e) => showToast('Recorder error: ' + e.error?.message, 5000);
      state.mediaRecorder.start(1000);
      state.recording = true;

      screenTrack.addEventListener('ended', stopRecording);

      // 8. Update UI — hide bar so it doesn't appear in the recording
      document.getElementById('sr-dot').classList.add('on');
      document.getElementById('sr-source').style.display    = 'none';
      document.getElementById('sr-rec-btn').style.display   = 'none';
      document.getElementById('sr-pause-btn').style.display = 'inline-flex';
      document.getElementById('sr-stop-btn').style.display  = 'inline-flex';
      document.getElementById('sr-bar').style.display       = 'none';

      // 8b. Webcam face preview via Picture-in-Picture — floats as an OS-level
      //     overlay so it is NOT captured by getDisplayMedia.
      if (state.webcamStream) {
        try {
          state.pipVid = document.createElement('video');
          state.pipVid.srcObject = state.webcamStream;
          state.pipVid.muted = true;
          // Tiny off-screen element — PiP only needs it in the DOM and playing
          Object.assign(state.pipVid.style, {
            position: 'fixed', top: '-2px', left: '-2px',
            width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
          });
          document.body.appendChild(state.pipVid);
          await state.pipVid.play();
          await state.pipVid.requestPictureInPicture();
        } catch (e) {
          console.warn('SR: PiP not available:', e);
          state.pipVid?.remove();
          state.pipVid = null;
        }
      }

      // 9. Timer
      state.seconds = 0;
      updateTimer();
      state.timerInterval = setInterval(() => { state.seconds++; updateTimer(); }, 1000);

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
      state.timerInterval = setInterval(() => { state.seconds++; updateTimer(); }, 1000);
      dot.classList.remove('paused');
      dot.classList.add('on');
      btn.innerHTML = '&#9646;&#9646; Pause';
      btn.classList.remove('resumed');
    }
  }

  function stopRecording() {
    if (!state.recording) return;

    clearInterval(state.timerInterval);
    state.recording = false;

    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
      state.mediaRecorder.stop();          // triggers saveFile via onstop
    }

    cleanupStreams();

    state.paused = false;
    document.getElementById('sr-bar').style.display       = 'flex';
    document.getElementById('sr-dot').classList.remove('on');
    document.getElementById('sr-dot').classList.remove('paused');
    document.getElementById('sr-cam-mini').classList.remove('active');
    document.getElementById('sr-source').style.display    = 'inline-block';
    document.getElementById('sr-rec-btn').style.display   = 'inline-flex';
    document.getElementById('sr-pause-btn').style.display = 'none';
    document.getElementById('sr-pause-btn').classList.remove('resumed');
    document.getElementById('sr-pause-btn').innerHTML = '&#9646;&#9646; Pause';
    document.getElementById('sr-stop-btn').style.display  = 'none';
    document.getElementById('sr-webcam').classList.remove('active');
    // Reset bubble position
    const bubble = document.getElementById('sr-webcam');
    bubble.style.left   = '28px';
    bubble.style.top    = '';
    bubble.style.right  = '';
    bubble.style.bottom = '28px';
    document.getElementById('sr-timer').textContent = '0:00';
  }

  function cleanupStreams() {
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

    showToast('Recording saved to Downloads!', 3000);
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
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // H.264 + AAC — preferred
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/webm;codecs=vp9,opus',               // fallback if MP4 unsupported
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidates.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
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
    document.getElementById('sr-bar')?.remove();
    document.getElementById('sr-webcam')?.remove();
    document.getElementById('sr-toast')?.remove();
    document.getElementById('sr-styles')?.remove();
    window.__srLoaded = false;
  }

  // ─── Entry point ─────────────────────────────────────────────────────────
  buildUI();

})();
