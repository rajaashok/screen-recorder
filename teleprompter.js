// ── Teleprompter popup script ──────────────────────────────────────────────
// Runs inside teleprompter.html (a proper extension page — no CSP issues).
// Communicates with the recorder tab via postMessage.

const ta     = document.getElementById('ta');
const slSz   = document.getElementById('sl-size');
const slSp   = document.getElementById('sl-speed');
const vSz    = document.getElementById('v-size');
const vSp    = document.getElementById('v-speed');
const setup  = document.getElementById('setup');
const sv     = document.getElementById('scroll-view');
const txt    = document.getElementById('txt');

let rafId = null;

// ── Persist script across sessions ────────────────────────────────────────
const STORAGE_KEY = 'sr_tp_text';
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) ta.value = saved;
vSz.textContent = slSz.value + 'px';
vSp.textContent = slSp.value;

// ── Sync state to opener (recorder tab) ──────────────────────────────────
function sync() {
  localStorage.setItem(STORAGE_KEY, ta.value);
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'tp-settings', text: ta.value, size: +slSz.value, speed: +slSp.value },
        '*'
      );
    }
  } catch {}
}

ta.addEventListener('input', sync);
slSz.addEventListener('input', () => { vSz.textContent = slSz.value + 'px'; sync(); });
slSp.addEventListener('input', () => { vSp.textContent = slSp.value;        sync(); });

// ── Stop scrolling, return to setup view ──────────────────────────────────
function stopScrolling() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  sv.classList.remove('on');
  setup.style.display = 'flex';
}

sv.addEventListener('click', stopScrolling);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') stopScrolling();
});

// ── Handle commands from recorder tab ────────────────────────────────────
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || !d.cmd) return;

  if (d.cmd === 'start') {
    setup.style.display = 'none';
    txt.textContent     = d.text || ta.value;
    txt.style.fontSize  = (d.size || +slSz.value) + 'px';

    const spd  = d.speed || +slSp.value;
    const winH = window.innerHeight;
    let y      = winH;
    let last   = performance.now();
    txt.style.top = y + 'px';

    sv.classList.add('on');
    if (rafId) cancelAnimationFrame(rafId);

    function tick(ts) {
      const dt = (ts - last) / 1000;
      last = ts;
      y -= spd * dt;
      const max = -(txt.offsetHeight + winH);
      if (y < max) { txt.style.top = max + 'px'; return; }
      txt.style.top = y + 'px';
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

  } else if (d.cmd === 'stop') {
    stopScrolling();
  }
});

// Send initial state so recorder tab has the saved text immediately
sync();
