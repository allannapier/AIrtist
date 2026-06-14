import type { RGB } from "./color";

export interface Quantized {
  /** Per-pixel cluster index (length = w*h). */
  labels: Int32Array;
  /** Cluster centroid colours. */
  centroids: RGB[];
}

/**
 * k-means colour quantisation over RGB. Deterministic seeding (evenly spaced
 * samples) so the same image always yields the same plan — important when the
 * output is a lesson the user can come back to.
 */
export function quantize(
  data: Uint8ClampedArray,
  pixelCount: number,
  k: number,
  iterations = 10,
): Quantized {
  const centroids: RGB[] = [];
  const step = Math.max(1, Math.floor(pixelCount / k));
  for (let c = 0; c < k; c++) {
    const p = (c * step) % pixelCount;
    centroids.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2]]);
  }

  const labels = new Int32Array(pixelCount);
  const sumR = new Float64Array(k);
  const sumG = new Float64Array(k);
  const sumB = new Float64Array(k);
  const counts = new Int32Array(k);

  for (let iter = 0; iter < iterations; iter++) {
    sumR.fill(0);
    sumG.fill(0);
    sumB.fill(0);
    counts.fill(0);

    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const cc = centroids[c];
        const d = (cc[0] - r) ** 2 + (cc[1] - g) ** 2 + (cc[2] - b) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      labels[i] = best;
      sumR[best] += r;
      sumG[best] += g;
      sumB[best] += b;
      counts[best]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = [sumR[c] / counts[c], sumG[c] / counts[c], sumB[c] / counts[c]];
      }
    }
  }

  return { labels, centroids };
}
