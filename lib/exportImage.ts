import { drawDab } from "./brush";
import { darken } from "./color";
import type { PaintingPlan, StrokePlan } from "./types";

// Render saved images larger than the on-screen canvas for a crisp keepsake,
// but never upscale tiny sources beyond 2x.
const EXPORT_MAX = 1600;

function exportScale(w: number, h: number): number {
  return Math.min(2, EXPORT_MAX / Math.max(w, h));
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png");
  });
}

/** The finished painterly render as a PNG blob. */
export function exportPaintingPNG(plan: PaintingPlan): Promise<Blob> {
  const rs = exportScale(plan.width, plan.height);
  const w = Math.round(plan.width * rs);
  const h = Math.round(plan.height * rs);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = plan.background;
  ctx.fillRect(0, 0, w, h);
  for (const s of plan.strokes) drawDab(ctx, s, rs, 1, false);
  return toBlob(canvas);
}

/** The finished outline render as a PNG blob. */
export function exportOutlinePNG(plan: StrokePlan, showFill: boolean): Promise<Blob> {
  const rs = exportScale(plan.width, plan.height);
  const w = Math.round(plan.width * rs);
  const h = Math.round(plan.height * rs);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, w, h);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const s of plan.strokes) {
    const path = new Path2D();
    s.path.forEach(([x, y], i) => {
      if (i === 0) path.moveTo(x * rs, y * rs);
      else path.lineTo(x * rs, y * rs);
    });
    if (s.closed) path.closePath();
    if (showFill) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.55;
      ctx.fill(path);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = darken(s.color, 0.55);
    ctx.lineWidth = Math.max(1, s.width * rs);
    ctx.stroke(path);
  }
  return toBlob(canvas);
}
