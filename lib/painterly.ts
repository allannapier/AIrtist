import { rgbToHex, type RGB } from "./color";
import { gaussianBlurRGBA } from "./smooth";
import type { BrushStroke, PainterlyOptions, PaintingPlan } from "./types";

interface InternalStroke {
  x: number;
  y: number;
  length: number;
  width: number;
  angle: number;
  color: RGB;
  opacity: number;
  level: number;
  error: number;
}

function bandFor(level: number, levels: number): { band: string; hint: string } {
  const t = levels <= 1 ? 1 : level / (levels - 1);
  if (t < 0.25)
    return { band: "wash", hint: "Tone the canvas and block the largest masses with broad strokes." };
  if (t < 0.55)
    return { band: "local colour", hint: "Lay broad strokes of local colour, following the form." };
  if (t < 0.8)
    return { band: "mid-tones", hint: "Build mid-tones and shape the transitions." };
  return { band: "accents", hint: "Add the final accents and fine detail." };
}

/**
 * Coarse-to-fine, optimisation-based stroke painter (stroke-based rendering).
 *
 * For each pass (largest brush first) it walks a grid over the image, and
 * wherever the current painting still differs from the target it lays an
 * oriented brush dab — coloured from the target, angled along local image
 * structure — then blends that dab into a running canvas so finer passes only
 * correct what's left. The result is an ordered, painterly stroke sequence:
 * broad base masses first, fine accents last.
 */
export function generatePainting(
  imageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  o: PainterlyOptions,
): PaintingPlan {
  const { data, width: w, height: h } = imageData;
  const n = w * h;
  const scale = (sourceWidth / w + sourceHeight / h) / 2;

  // Calm noise before sampling colour and structure.
  const blurred = gaussianBlurRGBA(data, w, h, o.sampleBlur);

  // Target colour planes + grayscale for gradient/orientation.
  const tR = new Float32Array(n);
  const tG = new Float32Array(n);
  const tB = new Float32Array(n);
  const gray = new Float32Array(n);
  let meanR = 0;
  let meanG = 0;
  let meanB = 0;
  for (let i = 0; i < n; i++) {
    const r = blurred[i * 4];
    const g = blurred[i * 4 + 1];
    const b = blurred[i * 4 + 2];
    tR[i] = r;
    tG[i] = g;
    tB[i] = b;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    meanR += r;
    meanG += g;
    meanB += b;
  }
  meanR /= n;
  meanG /= n;
  meanB /= n;

  const at = (x: number, y: number) =>
    Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x));

  // Brush-width schedule: geometric from coarsest fraction down to finestPx.
  const coarsest = Math.max(o.finestPx + 1, o.coarsestFraction * Math.max(w, h));
  const sizes: number[] = [];
  for (let l = 0; l < o.levels; l++) {
    const t = o.levels <= 1 ? 0 : l / (o.levels - 1);
    sizes.push(coarsest * Math.pow(o.finestPx / coarsest, t));
  }

  // One coarse-to-fine pass at a given error threshold. Lower threshold = more
  // strokes. Returns candidate strokes; the canvas buffer is local to the pass.
  const paintPass = (threshold: number): InternalStroke[] => {
    const cR = new Float32Array(n).fill(meanR);
    const cG = new Float32Array(n).fill(meanG);
    const cB = new Float32Array(n).fill(meanB);
    const strokes: InternalStroke[] = [];

    for (let level = 0; level < sizes.length; level++) {
      const minor = sizes[level];
      const major = minor * o.lengthRatio;
      const step = Math.max(1, Math.round(minor * o.spacing));
      const sampleRad = Math.max(1, Math.round(minor * 0.5));
      // Base masses fully opaque; detail passes only slightly translucent so
      // they still read crisply over the underpainting.
      const opacity = 1.0 - 0.2 * (level / Math.max(1, sizes.length - 1));

      for (let cy = Math.floor(step / 2); cy < h; cy += step) {
        for (let cx = Math.floor(step / 2); cx < w; cx += step) {
          // Average target vs. current canvas over the brush footprint.
          let dr = 0;
          let dg = 0;
          let db = 0;
          let sr = 0;
          let sg = 0;
          let sb = 0;
          let count = 0;
          for (let oy = -sampleRad; oy <= sampleRad; oy += sampleRad) {
            for (let ox = -sampleRad; ox <= sampleRad; ox += sampleRad) {
              const i = at(cx + ox, cy + oy);
              sr += tR[i];
              sg += tG[i];
              sb += tB[i];
              dr += (tR[i] - cR[i]) ** 2;
              dg += (tG[i] - cG[i]) ** 2;
              db += (tB[i] - cB[i]) ** 2;
              count++;
            }
          }
          const error = (dr + dg + db) / count;
          if (error <= threshold) continue;

          // Orientation from the local gradient (stroke runs along the edge).
          const gx =
            gray[at(cx + 1, cy)] - gray[at(cx - 1, cy)] +
            0.5 * (gray[at(cx + 1, cy - 1)] - gray[at(cx - 1, cy - 1)]) +
            0.5 * (gray[at(cx + 1, cy + 1)] - gray[at(cx - 1, cy + 1)]);
          const gy =
            gray[at(cx, cy + 1)] - gray[at(cx, cy - 1)] +
            0.5 * (gray[at(cx - 1, cy + 1)] - gray[at(cx - 1, cy - 1)]) +
            0.5 * (gray[at(cx + 1, cy + 1)] - gray[at(cx + 1, cy - 1)]);
          const mag = Math.hypot(gx, gy);
          // Perpendicular to the gradient = along the edge.
          const angle = mag > 8 ? Math.atan2(gx, -gy) : 0;
          // In flat areas (low gradient) make the dab rounder.
          const lengthScale = mag > 8 ? 1 : 0.6;

          const color: RGB = [sr / count, sg / count, sb / count];
          const dabLen = major * lengthScale;

          strokes.push({ x: cx, y: cy, length: dabLen, width: minor, angle, color, opacity, level, error });
          paintDab(cR, cG, cB, w, h, cx, cy, dabLen, minor, angle, color, opacity);
        }
      }
    }
    return strokes;
  };

  // Adaptive threshold (downward only): a fixed threshold under-fills
  // low-contrast images, so lower it until a pass yields the target count.
  // We never *raise* it to trim overflow — that would drop the coarse strokes
  // that cover smooth regions and leave blank patches. Overflow is instead
  // trimmed by keeping the highest-error strokes, which preserves coverage
  // (each region's first, high-error covering stroke survives) while spending
  // the rest of the budget on detail.
  const target = Math.round(o.maxStrokes * 0.9);
  let threshold = o.errorThreshold;
  let strokes = paintPass(threshold);
  for (let tries = 0; strokes.length < target && threshold > 4 && tries < 6; tries++) {
    threshold *= 0.4;
    strokes = paintPass(threshold);
  }

  const capped =
    strokes.length > o.maxStrokes
      ? strokes.slice().sort((a, b) => b.error - a.error).slice(0, o.maxStrokes)
      : strokes.slice();
  capped.sort((a, b) => a.level - b.level || b.error - a.error);

  const out: BrushStroke[] = capped.map((s, i) => {
    const { band, hint } = bandFor(s.level, sizes.length);
    return {
      id: i,
      x: Math.round(s.x * (sourceWidth / w)),
      y: Math.round(s.y * (sourceHeight / h)),
      length: Math.round(s.length * scale * 10) / 10,
      width: Math.round(s.width * scale * 10) / 10,
      angle: Math.round(s.angle * 1000) / 1000,
      color: rgbToHex(s.color),
      opacity: Math.round(s.opacity * 100) / 100,
      level: s.level,
      band,
      hint,
    };
  });

  return {
    width: sourceWidth,
    height: sourceHeight,
    background: rgbToHex([meanR, meanG, meanB]),
    strokes: out,
  };
}

/** Soft-edged elliptical brush dab alpha-blended into the running canvas. */
function paintDab(
  cR: Float32Array,
  cG: Float32Array,
  cB: Float32Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  length: number,
  width: number,
  angle: number,
  color: RGB,
  opacity: number,
): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const a = length / 2;
  const b = width / 2;
  const reach = Math.ceil(Math.max(a, b));

  for (let oy = -reach; oy <= reach; oy++) {
    const yy = cy + oy;
    if (yy < 0 || yy >= h) continue;
    for (let ox = -reach; ox <= reach; ox++) {
      const xx = cx + ox;
      if (xx < 0 || xx >= w) continue;
      // Rotate offset into the brush's local frame.
      const u = ox * cos + oy * sin;
      const v = -ox * sin + oy * cos;
      const d = (u * u) / (a * a) + (v * v) / (b * b);
      if (d > 1) continue;
      // Solid core with a soft rim: full strength inside 65% of the radius,
      // then ramp to zero. Keeps strokes defined instead of muddy.
      const r = Math.sqrt(d);
      const falloff = r < 0.65 ? 1 : (1 - r) / 0.35;
      const alpha = opacity * falloff;
      if (alpha <= 0) continue;
      const i = yy * w + xx;
      cR[i] = cR[i] * (1 - alpha) + color[0] * alpha;
      cG[i] = cG[i] * (1 - alpha) + color[1] * alpha;
      cB[i] = cB[i] * (1 - alpha) + color[2] * alpha;
    }
  }
}
