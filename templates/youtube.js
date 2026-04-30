// ─────────────────────────────────────────────────────────────
//  Template: YouTube
//  Webcam portrait panel (left) + screen panel (right)
//  Zoomed in — minimal padding for maximum content area
//  Canvas: 1920 × 1080
// ─────────────────────────────────────────────────────────────

window.SR_TEMPLATES = window.SR_TEMPLATES || {};
window.SR_TEMPLATES['youtube'] = {
  label:  'YouTube',
  width:  1920,
  height: 1080,
  draw({ ctx, CW, CH, screenVid, camVid, rrect, drawBranding, setScreenBounds }) {
    const pad    = Math.round(CH * 0.028);
    const gap    = Math.round(CH * 0.014);
    const radius = Math.round(CH * 0.032);
    const camPW  = Math.round(CW * 0.275);
    const camPH  = CH - pad * 2;
    const scrX   = pad + camPW + gap;
    const scrW   = CW - scrX - pad;
    const scrH   = CH - pad * 2;

    // Dark warm background
    ctx.fillStyle = '#100c08';
    ctx.fillRect(0, 0, CW, CH);
    const glow = ctx.createRadialGradient(CW * 0.35, CH * 0.9, 0, CW * 0.35, CH * 0.45, CW * 0.85);
    glow.addColorStop(0,   'rgba(160,65,12,0.5)');
    glow.addColorStop(0.5, 'rgba(70,25,5,0.2)');
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CW, CH);

    // Screen panel (right) — cover: fill panel, crop edges
    if (screenVid && screenVid.readyState >= 2) {
      ctx.save();
      rrect(ctx, scrX, pad, scrW, scrH, radius);
      ctx.clip();
      const svAR  = (screenVid.videoWidth  || scrW) / (screenVid.videoHeight || scrH);
      const panAR = scrW / scrH;
      let dw, dh, dx, dy;
      if (svAR > panAR) { dw = scrW; dh = dw / svAR; dx = scrX; dy = pad + (scrH - dh) / 2; }
      else               { dh = scrH; dw = dh * svAR; dx = scrX + (scrW - dw) / 2; dy = pad; }
      ctx.fillStyle = '#000';
      ctx.fillRect(scrX, pad, scrW, scrH);
      ctx.drawImage(screenVid, dx, dy, dw, dh);
      ctx.restore();
      setScreenBounds && setScreenBounds({ dx, dy, dw, dh });
      drawBranding(ctx, CW, CH, scrX, scrW, scrH, pad);
    }

    // Webcam panel (left) — cover: fill panel, crop sides (no wasted space)
    ctx.save();
    rrect(ctx, pad, pad, camPW, camPH, radius);
    ctx.clip();
    ctx.fillStyle = '#1a1412';
    ctx.fillRect(pad, pad, camPW, camPH);
    if (camVid && camVid.readyState >= 2) {
      const cvAR  = (camVid.videoWidth  || camPW) / (camVid.videoHeight || camPH);
      const panAR = camPW / camPH;
      let dw, dh, dx, dy;
      if (cvAR > panAR) { dh = camPH; dw = dh * cvAR; dx = pad - (dw - camPW) / 2; dy = pad; }
      else               { dw = camPW; dh = dw / cvAR; dx = pad; dy = pad - (dh - camPH) / 2; }
      ctx.drawImage(camVid, dx, dy, dw, dh);
    }
    ctx.restore();
  },
};
