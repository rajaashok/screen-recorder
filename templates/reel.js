// ─────────────────────────────────────────────────────────────
//  Template: Reel
//  Vertical 9:16 format — face large at top, screen overlay below
//  Canvas: 1080 × 1920
// ─────────────────────────────────────────────────────────────

window.SR_TEMPLATES = window.SR_TEMPLATES || {};
window.SR_TEMPLATES['reel'] = {
  label:  'Reel',
  width:  1080,
  height: 1920,
  draw({ ctx, CW, CH, screenVid, camVid, rrect, drawBranding }) {
    const pad    = Math.round(CW * 0.038);   // ~41px
    const gap    = Math.round(CW * 0.022);   // ~24px
    const radius = Math.round(CW * 0.048);   // ~52px

    const usable = CH - pad * 2 - gap;
    const scrW   = CW - pad * 2;
    const scrH   = Math.round(usable * 0.75);   // 75% — screen top
    const scrX   = pad;
    const scrY   = pad;

    const camW   = CW - pad * 2;
    const camH   = usable - scrH;               // 25% — face bottom
    const camX   = pad;
    const camY   = scrY + scrH + gap;

    // Dark background with vertical warm gradient
    ctx.fillStyle = '#0e0a08';
    ctx.fillRect(0, 0, CW, CH);
    const glow = ctx.createRadialGradient(CW * 0.5, CH * 0.75, 0, CW * 0.5, CH * 0.75, CH * 0.65);
    glow.addColorStop(0,   'rgba(140,55,10,0.45)');
    glow.addColorStop(0.6, 'rgba(60,20,5,0.18)');
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CW, CH);

    // Screen panel (top, 75%)
    // Blurred cover fill behind a sharp contained layer — no black bars, full content visible
    if (screenVid && screenVid.readyState >= 2) {
      const svAR  = (screenVid.videoWidth  || scrW) / (screenVid.videoHeight || scrH);
      const panAR = scrW / scrH;

      // Contain dimensions (sharp, full screen)
      let dw, dh, dx, dy;
      if (svAR > panAR) { dw = scrW; dh = dw / svAR; dx = scrX; dy = scrY + (scrH - dh) / 2; }
      else               { dh = scrH; dw = dh * svAR; dx = scrX + (scrW - dw) / 2; dy = scrY; }

      // Cover dimensions (blurred background fill)
      let bw, bh, bx, by;
      if (svAR > panAR) { bh = scrH; bw = bh * svAR; bx = scrX - (bw - scrW) / 2; by = scrY; }
      else               { bw = scrW; bh = bw / svAR; bx = scrX; by = scrY - (bh - scrH) / 2; }

      ctx.save();
      rrect(ctx, scrX, scrY, scrW, scrH, radius);
      ctx.clip();

      // Blurred fill
      ctx.filter = 'blur(18px) brightness(0.55)';
      ctx.drawImage(screenVid, bx, by, bw, bh);
      ctx.filter = 'none';

      // Sharp contained screen on top
      ctx.drawImage(screenVid, dx, dy, dw, dh);
      ctx.restore();

      drawBranding(ctx, CW, CH, scrX, scrW, scrH, scrY);
    }

    // Webcam panel (bottom, 25%) — cover: zoom in on face
    ctx.save();
    rrect(ctx, camX, camY, camW, camH, radius);
    ctx.clip();
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(camX, camY, camW, camH);
    if (camVid && camVid.readyState >= 2) {
      const cvAR  = (camVid.videoWidth  || camW) / (camVid.videoHeight || camH);
      const panAR = camW / camH;
      let dw, dh, dx, dy;
      if (cvAR > panAR) { dh = camH; dw = dh * cvAR; dx = camX - (dw - camW) / 2; dy = camY; }
      else               { dw = camW; dh = dw / cvAR; dx = camX; dy = camY - (dh - camH) / 2; }
      ctx.drawImage(camVid, dx, dy, dw, dh);
    }
    ctx.restore();
  },
};
