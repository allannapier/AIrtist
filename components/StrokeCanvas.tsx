"use client";

import { useMemo } from "react";
import { darken } from "@/lib/color";
import type { StrokePlan } from "@/lib/types";

interface Props {
  plan: StrokePlan;
  /** Fractional stroke index: 3.5 = three strokes done + half of the fourth. */
  progress: number;
  showFill: boolean;
  showGhost: boolean;
}

function pathData(points: [number, number][], closed: boolean): string {
  if (points.length === 0) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`;
  }
  if (closed) d += " Z";
  return d;
}

export default function StrokeCanvas({ plan, progress, showFill, showGhost }: Props) {
  const paths = useMemo(
    () => plan.strokes.map((s) => pathData(s.path, s.closed)),
    [plan],
  );

  const current = Math.floor(progress);

  return (
    <div className="canvas-wrap">
      <svg
        viewBox={`0 0 ${plan.width} ${plan.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Stroke-by-stroke drawing canvas"
      >
        {plan.strokes.map((stroke, i) => {
          let frac: number;
          if (i < current) frac = 1;
          else if (i === current) frac = Math.min(1, Math.max(0, progress - current));
          else frac = 0;

          const isGhost = showGhost && i === current + 1 && frac === 0;
          if (frac <= 0 && !isGhost) return null;

          const d = paths[i];
          const line = darken(stroke.color, 0.55);

          if (isGhost) {
            return (
              <path
                key={stroke.id}
                d={d}
                fill="none"
                stroke={line}
                strokeWidth={stroke.width}
                strokeOpacity={0.18}
                strokeDasharray="4 4"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }

          return (
            <path
              key={stroke.id}
              d={d}
              fill={showFill ? stroke.color : "none"}
              fillOpacity={showFill ? 0.55 * frac : 0}
              stroke={line}
              strokeWidth={stroke.width}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - frac}
            />
          );
        })}
      </svg>
    </div>
  );
}
