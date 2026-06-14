"use client";

import { useEffect, useRef } from "react";
import type { BrushStroke, PaintingPlan } from "@/lib/types";

interface Props {
  plan: PaintingPlan;
  /** Fractional stroke index: 3.5 = three dabs done + half of the fourth. */
  progress: number;
  showGhost: boolean;
}

const MAX_BACKING = 1000; // cap canvas resolution for big source images

function drawDab(
  ctx: CanvasRenderingContext2D,
  s: BrushStroke,
  rs: number,
  frac: number,
  ghost: boolean,
) {
  // Grow the dab along its length as it's laid down, like a brush swipe.
  const grow = ghost ? 1 : 0.55 + 0.45 * frac;
  const a = Math.max(0.5, (s.length / 2) * rs * grow);
  const b = Math.max(0.5, (s.width / 2) * rs);
  const alpha = ghost ? 0.12 : s.opacity * frac;

  ctx.save();
  ctx.translate(s.x * rs, s.y * rs);
  ctx.rotate(s.angle);
  ctx.scale(a, b);
  // Solid core to 65% of the radius, then a soft rim — matches the engine's
  // brush profile so strokes read as defined dabs, not blurry blobs.
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

function drawLine(
  ctx: CanvasRenderingContext2D,
  s: BrushStroke,
  rs: number,
  frac: number,
  ghost: boolean,
) {
  const pts = s.points;
  if (!pts || pts.length < 2) return;

  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  }
  const target = (ghost ? 1 : frac) * total * rs;

  ctx.save();
  ctx.strokeStyle = withAlpha(s.color, ghost ? 0.18 : s.opacity);
  ctx.lineWidth = Math.max(1, s.width * rs);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (ghost) ctx.setLineDash([4, 4]);

  ctx.beginPath();
  ctx.moveTo(pts[0][0] * rs, pts[0][1] * rs);
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const x0 = pts[k - 1][0] * rs;
    const y0 = pts[k - 1][1] * rs;
    const x1 = pts[k][0] * rs;
    const y1 = pts[k][1] * rs;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (acc + seg <= target) {
      ctx.lineTo(x1, y1);
      acc += seg;
    } else {
      const t = seg > 0 ? (target - acc) / seg : 0;
      ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      break;
    }
  }
  ctx.stroke();
  ctx.restore();
}

function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function PaintingCanvas({ plan, progress, showGhost }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rs = Math.min(1, MAX_BACKING / Math.max(plan.width, plan.height));
  const backW = Math.round(plan.width * rs);
  const backH = Math.round(plan.height * rs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, backW, backH);
    ctx.fillStyle = plan.background;
    ctx.fillRect(0, 0, backW, backH);

    const current = Math.floor(progress);
    const paint = (s: (typeof plan.strokes)[number], frac: number, ghost: boolean) =>
      s.kind === "line" ? drawLine(ctx, s, rs, frac, ghost) : drawDab(ctx, s, rs, frac, ghost);

    for (let i = 0; i < plan.strokes.length; i++) {
      if (i < current) paint(plan.strokes[i], 1, false);
      else if (i === current) {
        const frac = Math.min(1, Math.max(0, progress - current));
        if (frac > 0) paint(plan.strokes[i], frac, false);
      } else if (showGhost && i === current + 1) {
        paint(plan.strokes[i], 1, true);
      }
    }
  }, [plan, progress, showGhost, rs, backW, backH]);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        width={backW}
        height={backH}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Painterly stroke-by-stroke canvas"
      />
    </div>
  );
}

export type { BrushStroke };
