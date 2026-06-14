"use client";

import { useEffect, useRef } from "react";
import { drawDab } from "@/lib/brush";
import type { PaintingPlan } from "@/lib/types";

interface Props {
  plan: PaintingPlan;
  /** Fractional stroke index: 3.5 = three dabs done + half of the fourth. */
  progress: number;
  showGhost: boolean;
}

const MAX_BACKING = 1100; // cap canvas resolution for big source images

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
