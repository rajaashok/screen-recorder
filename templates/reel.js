// ─────────────────────────────────────────────────────────────
//  Template: Reel  1080 × 1920
//
//  Phase 1 (0–5 s)
//    TOP 67%   screen share, cover-fill
//    BOT 33%   camera tile, full-width floating
//    OVERLAY   brand bookmark floats over bottom-right of screen
//
//  Phase 2 (5 s+, 1.5 s ease-out)
//    TOP 67%   screen share unchanged
//    BOT 33%   camera tile (left, narrows) + brand tile (right, rolls in)
//              brand tile slides DOWN from overlay position into strip
// ─────────────────────────────────────────────────────────────

window.SR_TEMPLATES = window.SR_TEMPLATES || {};
window.SR_TEMPLATES['reel'] = {
  label:  'Reel',
  width:  1080,
  height: 1920,

  draw({ ctx, CW, CH, screenVid, camVid, rrect, elapsed, setScreenBounds }) {

    function lerp(a, b, t) { return a + (b - a) * t; }

    // ── Transition ────────────────────────────────────────────────────────
    const SPLIT = 5, TRANS = 1.5;
    const raw  = elapsed > SPLIT ? Math.min(1, (elapsed - SPLIT) / TRANS) : 0;
    const prog = 1 - Math.pow(1 - raw, 3);   // ease-out cubic, 0→1

    // ── Layout constants ──────────────────────────────────────────────────
    const screenH = Math.round(CH * 0.67);   // 1286
    const stripH  = CH - screenH;            // 634
    const PAD = 24, GAP = 20, R = 22;

    // Brand tile — right-anchored, ~37% canvas width
    const bW = Math.round(CW * 0.37);        // ~400
    const bX = CW - PAD - bW;               // ~656, same in both phases

    // Phase 1: compact bookmark overlaid on screen (bottom-right of screen area)
    const bH_p1 = Math.round(stripH * 0.72); // ~456
    const bY_p1 = screenH - PAD - bH_p1;     // ~806 — sits over screen

    // Phase 2: full-height tile in strip
    const bH_p2 = stripH - PAD * 2;          // 586
    const bY_p2 = screenH + PAD;             // 1310

    // Animated brand tile position/size
    const bY = Math.round(lerp(bY_p1, bY_p2, prog));
    const bH = Math.round(lerp(bH_p1, bH_p2, prog));

    // Camera tile — left-anchored in strip
    const camX    = PAD;
    const camY    = screenH + PAD;
    const camH    = stripH - PAD * 2;        // 586
    const camW_p1 = CW - PAD * 2;           // 1032 (full-width phase 1)
    const camW_p2 = bX - GAP - PAD;         // 612  (leaves room for brand)
    const camW    = Math.round(lerp(camW_p1, camW_p2, prog));

    // ── Canvas background ─────────────────────────────────────────────────
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, CW, CH);

    // ── Screen share — cover-fill, clipped ────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, CW, screenH);
    ctx.clip();

    if (screenVid && screenVid.readyState >= 2) {
      const svAR  = (screenVid.videoWidth  || CW) / (screenVid.videoHeight || screenH);
      const panAR = CW / screenH;

      // Contain — all content visible, no cropping
      let dw, dh, dx, dy;
      if (svAR > panAR) { dw = CW; dh = dw / svAR; dx = 0; dy = (screenH - dh) / 2; }
      else               { dh = screenH; dw = dh * svAR; dx = (CW - dw) / 2; dy = 0; }

      // Cover — blurred fill behind the letterbox bars
      let bw, bh, bx, by;
      if (svAR > panAR) { bh = screenH; bw = bh * svAR; bx = -(bw - CW) / 2; by = 0; }
      else               { bw = CW; bh = bw / svAR; bx = 0; by = -(bh - screenH) / 2; }

      ctx.filter = 'blur(20px) brightness(0.45)';
      ctx.drawImage(screenVid, bx, by, bw, bh);
      ctx.filter = 'none';
      ctx.drawImage(screenVid, dx, dy, dw, dh);

      setScreenBounds && setScreenBounds({ dx, dy, dw, dh });
    }
    ctx.restore();

    // Soft vignette at bottom of screen → tiles feel like they float above
    const vign = ctx.createLinearGradient(0, screenH - 140, 0, screenH);
    vign.addColorStop(0, 'rgba(0,0,0,0)');
    vign.addColorStop(1, 'rgba(0,0,0,0.50)');
    ctx.fillStyle = vign;
    ctx.fillRect(0, screenH - 140, CW, 140);

    // ── Tile helper: shadow → clip → content → border ────────────────────
    function drawTile(x, y, w, h, r, fillFn) {
      // Shadow (outside clip so it bleeds naturally)
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.72)';
      ctx.shadowBlur    = 40;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle     = '#1c1c1e';
      rrect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();

      // Content clipped to rounded rect
      ctx.save();
      rrect(ctx, x, y, w, h, r);
      ctx.clip();
      fillFn();
      ctx.restore();

      // Frosted border
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth   = 1.5;
      rrect(ctx, x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }

    // ── Camera tile ───────────────────────────────────────────────────────
    drawTile(camX, camY, camW, camH, R, () => {
      ctx.fillStyle = '#141416';
      ctx.fillRect(camX, camY, camW, camH);

      if (camVid && camVid.readyState >= 2) {
        const cvAR = (camVid.videoWidth || 1) / (camVid.videoHeight || 1);
        const tAR  = camW / camH;
        let dw, dh, dx, dy;
        if (cvAR > tAR) {
          dh = camH; dw = dh * cvAR;
          dx = camX - (dw - camW) / 2; dy = camY;
        } else {
          dw = camW; dh = dw / cvAR;
          dx = camX; dy = camY - (dh - camH) / 2;
        }
        ctx.drawImage(camVid, dx, dy, dw, dh);
      }
    });

    // ── Brand bookmark tile (animated position) ───────────────────────────
    const b      = window.SR_BRANDING;
    const accent = (b && b.accentColor) || '#ff3b30';
    const TAB_H  = 5;   // bookmark tab stripe at top of tile

    drawTile(bX, bY, bW, bH, R, () => {
      // Card background
      const bg = ctx.createLinearGradient(bX, bY, bX, bY + bH);
      bg.addColorStop(0, '#222228');
      bg.addColorStop(1, '#161619');
      ctx.fillStyle = bg;
      ctx.fillRect(bX, bY, bW, bH);

      // Bookmark tab — accent stripe at very top
      ctx.fillStyle = accent;
      ctx.fillRect(bX, bY, bW, TAB_H);

      if (b && b.show) {
        const name     = (b.name    || '').trim();
        const title    = (b.title   || '').trim();
        const company  = (b.company || '').trim();
        const website  = (b.website || '').trim();
        const subtitle = [title, company].filter(Boolean).join('  ·  ');
        const ff       = "system-ui,-apple-system,'Segoe UI',Arial,sans-serif";

        if (name) {
          const lines   = [name, subtitle, website].filter(Boolean);
          // Size relative to tile WIDTH so text never overflows the tile
          const nSz     = Math.round(bW * 0.115);  // ~46px at 400px wide
          const sSz     = Math.round(bW * 0.075);  // ~30px
          const wSz     = Math.round(bW * 0.065);  // ~26px
          const sizes   = [nSz, sSz, wSz].slice(0, lines.length);
          const weights = ['700', '300', '500'];
          const colors  = ['#ffffff', 'rgba(255,255,255,0.58)', accent];
          const lGap    = Math.round(bH * 0.055);
          const maxTW   = bW - 24;   // max text width with padding

          const totalH = sizes.reduce((s, v) => s + v, 0) + lGap * (lines.length - 1);
          let tY = bY + TAB_H + (bH - TAB_H - totalH) / 2;

          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          ctx.shadowColor  = 'rgba(0,0,0,0.55)';
          ctx.shadowBlur   = 5;
          ctx.shadowOffsetY = 1;

          lines.forEach((line, i) => {
            ctx.font      = `${weights[i]} ${sizes[i]}px ${ff}`;
            ctx.fillStyle = colors[i];
            ctx.fillText(line, bX + bW / 2, tY, maxTW);
            tY += sizes[i] + lGap;
          });
        }
      }
    });
  },
};
