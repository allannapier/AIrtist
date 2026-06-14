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
    for (let i = 0; i < plan.strokes.length; i++) {
      if (i < current) drawDab(ctx, plan.strokes[i], rs, 1, false);
      else if (i === current) {
        const frac = Math.min(1, Math.max(0, progress - current));
        if (frac > 0) drawDab(ctx, plan.strokes[i], rs, frac, false);
      } else if (showGhost && i === current + 1) {
        drawDab(ctx, plan.strokes[i], rs, 1, true);
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
