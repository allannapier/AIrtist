/**
 * Pre-processing smoothers that tame high-frequency texture (foliage, fabric,
 * noise) so colour-region decomposition yields a handful of clean, drawable
 * shapes instead of thousands of speckled fragments.
 */

/** Separable Gaussian blur over an RGBA buffer. Returns a new buffer; alpha is
 *  left untouched. */
export function gaussianBlurRGBA(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sigma: number,
): Uint8ClampedArray {
  if (sigma <= 0) return new Uint8ClampedArray(data);

  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Uint8ClampedArray(data.length);
  const out = new Uint8ClampedArray(data.length);

  // Horizontal pass: data -> tmp
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(w - 1, Math.max(0, x + k));
        const p = (y * w + sx) * 4;
        const wk = kernel[k + radius];
        r += data[p] * wk;
        g += data[p + 1] * wk;
        b += data[p + 2] * wk;
      }
      const o = (y * w + x) * 4;
      tmp[o] = r;
      tmp[o + 1] = g;
      tmp[o + 2] = b;
      tmp[o + 3] = 255;
    }
  }

  // Vertical pass: tmp -> out
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(h - 1, Math.max(0, y + k));
        const p = (sy * w + x) * 4;
        const wk = kernel[k + radius];
        r += tmp[p] * wk;
        g += tmp[p + 1] * wk;
        b += tmp[p + 2] * wk;
      }
      const o = (y * w + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }

  return out;
}

/**
 * Majority (mode) filter over a label map: each pixel adopts the most common
 * label in its 3x3 neighbourhood, with ties resolved in favour of the current
 * label. Knocks out single-pixel speckle so connected components stay coherent.
 */
export function majorityFilter(
  labels: Int32Array,
  w: number,
  h: number,
  passes: number,
): Int32Array {
  let src = labels;
  const counts = new Map<number, number>();

  for (let pass = 0; pass < passes; pass++) {
    const dst = new Int32Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        counts.clear();
        const center = src[y * w + x];
        let best = center;
        let bestCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= w) continue;
            const lbl = src[ny * w + nx];
            const c = (counts.get(lbl) ?? 0) + 1;
            counts.set(lbl, c);
            // Prefer the centre label on ties for stability.
            if (c > bestCount || (c === bestCount && lbl === center)) {
              bestCount = c;
              best = lbl;
            }
          }
        }
        dst[y * w + x] = best;
      }
    }
    src = dst;
  }

  return src;
}
