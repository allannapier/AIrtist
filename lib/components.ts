/**
 * Connected-component labelling over a quantised label map. Each component is
 * a maximal run of 4-connected pixels sharing the same colour cluster — i.e. a
 * single fillable region of the picture.
 */
export interface Component {
  id: number;
  /** Colour cluster this region belongs to. */
  cluster: number;
  area: number;
  /** Topmost-then-leftmost pixel — a valid seed for boundary tracing. */
  seedX: number;
  seedY: number;
  /** Accumulated source colour, for a true mean fill. */
  sumR: number;
  sumG: number;
  sumB: number;
}

export interface ComponentResult {
  /** Per-pixel component id (length w*h), -1 where unlabelled. */
  compId: Int32Array;
  components: Component[];
}

export function labelComponents(
  labels: Int32Array,
  data: Uint8ClampedArray,
  w: number,
  h: number,
): ComponentResult {
  const compId = new Int32Array(w * h).fill(-1);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let start = 0; start < w * h; start++) {
    if (compId[start] !== -1) continue;
    const cluster = labels[start];
    const id = components.length;
    const comp: Component = {
      id,
      cluster,
      area: 0,
      seedX: start % w,
      seedY: Math.floor(start / w),
      sumR: 0,
      sumG: 0,
      sumB: 0,
    };

    stack.length = 0;
    stack.push(start);
    compId[start] = id;

    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      comp.area++;
      comp.sumR += data[p * 4];
      comp.sumG += data[p * 4 + 1];
      comp.sumB += data[p * 4 + 2];

      // 4-connectivity
      if (x > 0 && compId[p - 1] === -1 && labels[p - 1] === cluster) {
        compId[p - 1] = id;
        stack.push(p - 1);
      }
      if (x < w - 1 && compId[p + 1] === -1 && labels[p + 1] === cluster) {
        compId[p + 1] = id;
        stack.push(p + 1);
      }
      if (y > 0 && compId[p - w] === -1 && labels[p - w] === cluster) {
        compId[p - w] = id;
        stack.push(p - w);
      }
      if (y < h - 1 && compId[p + w] === -1 && labels[p + w] === cluster) {
        compId[p + w] = id;
        stack.push(p + w);
      }
    }

    components.push(comp);
  }

  return { compId, components };
}
