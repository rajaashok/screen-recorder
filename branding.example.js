// ─────────────────────────────────────────────────────────────
//  Screen Recorder — Branding Config
//
//  Copy this file to branding.js and fill in your details.
//  branding.js is gitignored — your personal info stays local.
//  Reload the extension after editing (chrome://extensions).
// ─────────────────────────────────────────────────────────────

window.SR_BRANDING = {

  // ── Identity ───────────────────────────────────────────────
  name:    'Your Name',
  title:   'Your Title',          // leave '' to hide
  company: '',                    // leave '' to hide
  website: 'yoursite.com',        // leave '' to hide

  // ── Appearance ─────────────────────────────────────────────
  show:         true,             // set false to disable branding entirely
  accentColor:  '#ff3b30',        // your brand colour
  position:     'bottom-right',   // 'bottom-left' | 'bottom-right'

  // ── Layout Template ────────────────────────────────────────
  template: 'youtube',            // 'youtube' | 'reel' | 'side-by-side' | 'screen-focus'

};
