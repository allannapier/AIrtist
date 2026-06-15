import { labelComponents } from "./components";
import { quantize } from "./quantize";
import type { PixelImage } from "./types";

/** A crop rectangle in normalised (0..1) image coordinates. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

function newImage(w: number, h: number): PixelImage {
  return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}

/** Extract a sub-rectangle (in pixels) as a new image. */
export function cropImage(src: PixelImage, x0: number, y0: number, cw: number, ch: number): PixelImage {
  const out = newImage(cw, ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * src.width + (x0 + x)) * 4;
      const di = (y * cw + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

/**
 * Remove the background by colour-region analysis: quantise the image, flag the
 * regions that touch the border (and any disconnected patch whose colour is
 * within `tolerance` of a border region), and fill them with `fill`. Isolates a
 * subject that sits on a reasonably distinct background — a flower, a glass — so
 * the painter spends its strokes on the subject, not the clutter.
 *
 * Deterministic, client-side, no ML. Busy/low-contrast backgrounds won't
 * separate cleanly — that's the job of a future ML cutout.
 */
export function removeBackground(
  src: PixelImage,
  tolerance: number,
  fill: [number, number, number] = [255, 255, 255],
): PixelImage {
  const { data, width: w, height: h } = src;
  const n = w * h;
  const { labels } = quantize(data, n, 14);
  const { compId, components } = labelComponents(labels, data, w, h);

  const isBg = new Uint8Array(components.length);
  const mark = (i: number) => {
    if (compId[i] >= 0) isBg[compId[i]] = 1;
  };
  for (let x = 0; x < w; x++) {
    mark(x);
    mark((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    mark(y * w);
    mark(y * w + w - 1);
  }

  const meanOf = (i: number): [number, number, number] => {
    const c = components[i];
    return [c.sumR / c.area, c.sumG / c.area, c.sumB / c.area];
  };

  // Same-colour patches not connected to the border (e.g. background showing
  // between petals) also count as background.
  if (tolerance > 0) {
    const bgColors: [number, number, number][] = [];
    for (let i = 0; i < components.length; i++) if (isBg[i]) bgColors.push(meanOf(i));
    const t2 = tolerance * tolerance;
    for (let i = 0; i < components.length; i++) {
      if (isBg[i]) continue;
      const m = meanOf(i);
      for (const bc of bgColors) {
        const d = (bc[0] - m[0]) ** 2 + (bc[1] - m[1]) ** 2 + (bc[2] - m[2]) ** 2;
        if (d < t2) {
          isBg[i] = 1;
          break;
        }
      }
    }
  }

  const out = newImage(w, h);
  for (let i = 0; i < n; i++) {
    if (isBg[compId[i]]) {
      out.data[i * 4] = fill[0];
      out.data[i * 4 + 1] = fill[1];
      out.data[i * 4 + 2] = fill[2];
    } else {
      out.data[i * 4] = data[i * 4];
      out.data[i * 4 + 1] = data[i * 4 + 1];
      out.data[i * 4 + 2] = data[i * 4 + 2];
    }
    out.data[i * 4 + 3] = 255;
  }
  return out;
}

/** Apply crop then optional background removal, producing the image the
 *  painter will actually work from. */
export function prepareImage(
  src: PixelImage,
  crop: CropRect,
  removeBg: boolean,
  tolerance: number,
): PixelImage {
  let img = src;
  const tight = crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999;
  if (tight) {
    const x0 = Math.max(0, Math.round(crop.x * src.width));
    const y0 = Math.max(0, Math.round(crop.y * src.height));
    const cw = Math.max(1, Math.min(src.width - x0, Math.round(crop.w * src.width)));
    const ch = Math.max(1, Math.min(src.height - y0, Math.round(crop.h * src.height)));
    img = cropImage(src, x0, y0, cw, ch);
  }
  if (removeBg) img = removeBackground(img, tolerance);
  return img;
}
