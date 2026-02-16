// world_node.js (FULL REPLACE)

export class WorldNode {
  constructor() {
    this.worldW = 320;
    this.worldH = 180;

    this.spawn = { x: 50, y: 90 };
    this.portal = { x: 270, y: 90, r: 12 };

    this.blocks = [
      { x: 130, y: 30, w: 18, h: 120 },
    ];
  }

  isBlockedCircle(x, y, r) {
    // bounds
    if (x < r || y < r || x > this.worldW - r || y > this.worldH - r) return true;

    // rect blocks
    for (const b of this.blocks) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) return true;
    }
    return false;
  }

  tryMoveCircle(x0, y0, x1, y1, r) {
    // simple slide: try full, else x-only, else y-only, else stay
    if (!this.isBlockedCircle(x1, y1, r)) return { x: x1, y: y1 };
    if (!this.isBlockedCircle(x1, y0, r)) return { x: x1, y: y0 };
    if (!this.isBlockedCircle(x0, y1, r)) return { x: x0, y: y1 };
    return { x: x0, y: y0 };
  }

  inPortal(x, y, r) {
    const dx = x - this.portal.x;
    const dy = y - this.portal.y;
    const rr = this.portal.r + r;
    return (dx * dx + dy * dy) <= (rr * rr);
  }

  draw(ctx, camX, camY, t) {
    // node world is same size as view, so cam is ignored
    (void)camX; (void)camY;

    ctx.fillStyle = "rgba(7,7,12,1)";
    ctx.fillRect(0, 0, 320, 180);

    // grid
    ctx.strokeStyle = "rgba(179,136,255,0.08)";
    for (let x = 0; x <= 320; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, 180);
      ctx.stroke();
    }
    for (let y = 0; y <= 180; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(320, y + 0.5);
      ctx.stroke();
    }

    // center block
    for (const b of this.blocks) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(179,136,255,0.15)";
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    }

    // portal
    const px = this.portal.x | 0;
    const py = this.portal.y | 0;

    ctx.strokeStyle = "rgba(179,136,255,0.85)";
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(179,136,255,0.12)";
    ctx.beginPath();
    ctx.arc(px, py, 11 + Math.sin(t * 4) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
