import type { BrushStroke } from "./types";

/** rgba() string from a #rrggbb hex and an alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Paint one brush dab. Shared by the live canvas and the PNG export so the
 * saved image matches exactly what the user watched.
 *
 * `rs` scales source-image coordinates to the target canvas; `frac` reveals a
 * dab mid-swipe (grows along its length); `ghost` draws a faint preview.
 */
export function drawDab(
  ctx: CanvasRenderingContext2D,
  s: BrushStroke,
  rs: number,
  frac: number,
  ghost: boolean,
): void {
  const grow = ghost ? 1 : 0.55 + 0.45 * frac;
  const a = Math.max(0.5, (s.length / 2) * rs * grow);
  const b = Math.max(0.5, (s.width / 2) * rs);
  const alpha = ghost ? 0.12 : s.opacity * frac;

  ctx.save();
  ctx.translate(s.x * rs, s.y * rs);
  ctx.rotate(s.angle);
  ctx.scale(a, b);
  // Solid core to 65% of the radius, then a soft rim — a defined dab, not a blob.
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, withAlpha(s.color, alpha));
  grad.addColorStop(0.65, withAlpha(s.color, alpha));
  grad.addColorStop(1, withAlpha(s.color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
