"use client";

import { useEffect, useRef } from "react";
import type { BrushStroke, PaintingPlan } from "@/lib/types";

interface Props {
  plan: PaintingPlan;
  /** Fractional stroke index: 3.5 = three dabs done + half of the fourth. */
  progress: number;
  showGhost: boolean;
}

const MAX_BACKING = 1100; // cap canvas resolution for big source images

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
  // Solid core to 65% of the radius, then a soft rim — defined dab, not blob.
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
  // Offscreen buffer of fully-committed strokes, so each frame only paints the
  // one in-progress dab on top — playback stays smooth at thousands of strokes.
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const committedRef = useRef(0);
  const planRef = useRef<PaintingPlan | null>(null);
  const sizeRef = useRef("");

  const rs = Math.min(1, MAX_BACKING / Math.max(plan.width, plan.height));
  const backW = Math.round(plan.width * rs);
  const backH = Math.round(plan.height * rs);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!offRef.current) offRef.current = document.createElement("canvas");
    const off = offRef.current;
    const sizeKey = `${backW}x${backH}`;
    const sizeChanged = sizeRef.current !== sizeKey;
    if (sizeChanged) {
      off.width = backW;
      off.height = backH;
      sizeRef.current = sizeKey;
    }
    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    const rebuild = (upTo: number) => {
      offCtx.clearRect(0, 0, backW, backH);
      offCtx.fillStyle = plan.background;
      offCtx.fillRect(0, 0, backW, backH);
      for (let i = 0; i < upTo; i++) drawDab(offCtx, plan.strokes[i], rs, 1, false);
      committedRef.current = upTo;
    };

    const current = Math.min(plan.strokes.length, Math.floor(progress));
    const planChanged = planRef.current !== plan;

    if (planChanged || sizeChanged) {
      planRef.current = plan;
      rebuild(current);
    } else if (current < committedRef.current) {
      rebuild(current); // scrubbed backward
    } else if (current > committedRef.current) {
      for (let i = committedRef.current; i < current; i++) {
        drawDab(offCtx, plan.strokes[i], rs, 1, false);
      }
      committedRef.current = current;
    }

    // Blit committed strokes, then the transient in-progress dab + ghost.
    ctx.clearRect(0, 0, backW, backH);
    ctx.drawImage(off, 0, 0);

    if (current < plan.strokes.length) {
      const frac = Math.min(1, Math.max(0, progress - current));
      if (frac > 0) drawDab(ctx, plan.strokes[current], rs, frac, false);
      if (showGhost && current + 1 < plan.strokes.length) {
        drawDab(ctx, plan.strokes[current + 1], rs, 1, true);
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
