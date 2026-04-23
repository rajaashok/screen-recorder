// ─────────────────────────────────────────────────────────────
//  Template: Screen Focus
//  Full-canvas screen recording with webcam circle overlay
//  in the bottom-left corner
// ─────────────────────────────────────────────────────────────

window.SR_TEMPLATES = window.SR_TEMPLATES || {};
window.SR_TEMPLATES['screen-focus'] = {
  label: 'Screen Focus',
  draw({ ctx, CW, CH, screenVid, camVid, rrect, drawBranding }) {
    const pad    = Math.round(CH * 0.040);
    const radius = Math.round(CH * 0.030);
    const scrX   = pad;
    const scrY   = pad;
    const scrW   = CW - pad * 2;
    const scrH   = CH - pad * 2;

    // Dark background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, CW, CH);

    // Screen panel (full canvas minus padding)
    if (screenVid && screenVid.readyState >= 2) {
      ctx.save();
      rrect(ctx, scrX, scrY, scrW, scrH, radius);
      ctx.clip();
      const svAR  = (screenVid.videoWidth  || scrW) / (screenVid.videoHeight || scrH);
      const panAR = scrW / scrH;
      let dw, dh, dx, dy;
      if (svAR > panAR) { dh = scrH; dw = dh * svAR; dx = scrX - (dw - scrW) / 2; dy = scrY; }
      else               { dw = scrW; dh = dw / svAR; dx = scrX; dy = scrY - (dh - scrH) / 2; }
      ctx.fillStyle = '#000';
      ctx.fillRect(scrX, scrY, scrW, scrH);
      ctx.drawImage(screenVid, dx, dy, dw, dh);
      ctx.restore();
      drawBranding(ctx, CW, CH, scrX, scrW, scrH, scrY);
    }

    // Webcam circle overlay — bottom-left
    if (camVid && camVid.readyState >= 2) {
      const r  = Math.round(CH * 0.13);
      const cx = scrX + Math.round(CH * 0.03) + r;
      const cy = scrY + scrH - Math.round(CH * 0.03) - r;

      ctx.save();
      // Shadow ring
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur  = 18;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fill();
      ctx.restore();

      // Clip to circle and draw cam
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const cvAR = (camVid.videoWidth || 1) / (camVid.videoHeight || 1);
      const diam = r * 2;
      let dw, dh, dx, dy;
      if (cvAR > 1) {
        dh = diam; dw = dh * cvAR;
        dx = cx - r - (dw - diam) / 2; dy = cy - r;
      } else {
        dw = diam; dh = dw / cvAR;
        dx = cx - r; dy = cy - r - (dh - diam) / 2;
      }
      ctx.drawImage(camVid, dx, dy, dw, dh);
      ctx.restore();

      // Accent ring border
      ctx.save();
      ctx.strokeStyle = (window.SR_BRANDING && window.SR_BRANDING.accentColor) || '#ff3b30';
      ctx.lineWidth   = Math.round(CH * 0.004);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },
};
