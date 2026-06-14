import { colorName, rgbToHex, type RGB } from "./color";
import { labelComponents } from "./components";
import { quantize } from "./quantize";
import { simplify } from "./simplify";
import { traceBoundary } from "./trace";
import {
  DEFAULT_OPTIONS,
  type Layer,
  type PipelineOptions,
  type Point,
  type Stroke,
  type StrokePlan,
} from "./types";

function layerFor(areaFraction: number): Layer {
  if (areaFraction > 0.06) return "block";
  if (areaFraction > 0.008) return "contour";
  return "detail";
}

function sizeWord(areaFraction: number): string {
  if (areaFraction > 0.15) return "large";
  if (areaFraction > 0.03) return "medium";
  if (areaFraction > 0.005) return "small";
  return "fine";
}

function positionWord([cx, cy]: Point, w: number, h: number): string {
  const col = cx < w / 3 ? "left" : cx > (2 * w) / 3 ? "right" : "centre";
  const row = cy < h / 3 ? "top" : cy > (2 * h) / 3 ? "bottom" : "middle";
  if (row === "middle" && col === "centre") return "centre";
  if (row === "middle") return col;
  if (col === "centre") return row;
  return `${row} ${col}`;
}

function buildHint(layer: Layer, areaFraction: number, rgb: RGB, pos: string): string {
  const colour = colorName(rgb);
  const size = sizeWord(areaFraction);
  switch (layer) {
    case "block":
      return `Block in the ${size} ${colour} shape in the ${pos}. Keep it loose — just the overall form.`;
    case "contour":
      return `Define the ${colour} contour in the ${pos}. Follow the edge in one confident pass.`;
    default:
      return `Add the ${size} ${colour} detail in the ${pos}.`;
  }
}

/**
 * Turn an image into an ordered stroke plan:
 *   downscale → k-means quantise → connected components → boundary trace →
 *   Douglas-Peucker simplify → order by area (big forms first).
 *
 * Coordinates in the returned plan are expressed in source-image pixels.
 */
export function generateStrokePlan(
  imageData: ImageData,
  sourceWidth: number,
  sourceHeight: number,
  opts: Partial<PipelineOptions> = {},
): StrokePlan {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const { data, width: w, height: h } = imageData;
  const pixelCount = w * h;
  const scaleX = sourceWidth / w;
  const scaleY = sourceHeight / h;

  const { labels } = quantize(data, pixelCount, o.colors);
  const { compId, components } = labelComponents(labels, data, w, h);

  const totalArea = pixelCount;
  const minArea = Math.max(8, Math.floor(totalArea * o.minAreaFraction));

  type Built = { stroke: Omit<Stroke, "id">; area: number };
  const built: Built[] = [];

  for (const comp of components) {
    if (comp.area < minArea) continue;

    const raw = traceBoundary(
      (x, y) => compId[y * w + x] === comp.id,
      w,
      h,
      comp.seedX,
      comp.seedY,
    );
    if (raw.length < 3) continue;

    const simplified = simplify(raw, o.simplifyTolerance);
    if (simplified.length < 2) continue;

    // Map back into source-image coordinates.
    const path: Point[] = simplified.map(([x, y]) => [
      Math.round(x * scaleX),
      Math.round(y * scaleY),
    ]);

    const meanRgb: RGB = [
      comp.sumR / comp.area,
      comp.sumG / comp.area,
      comp.sumB / comp.area,
    ];
    const areaFraction = comp.area / totalArea;
    const layer = layerFor(areaFraction);
    const centroid: Point = [
      Math.round((comp.seedX + 0) * scaleX),
      Math.round((comp.seedY + 0) * scaleY),
    ];
    // Better centroid: average of path points (cheap, good enough for hints).
    let cxSum = 0;
    let cySum = 0;
    for (const [px, py] of path) {
      cxSum += px;
      cySum += py;
    }
    centroid[0] = Math.round(cxSum / path.length);
    centroid[1] = Math.round(cySum / path.length);

    const pos = positionWord(centroid, sourceWidth, sourceHeight);

    built.push({
      area: comp.area,
      stroke: {
        layer,
        path,
        closed: true,
        color: rgbToHex(meanRgb),
        width: layer === "block" ? 3 : layer === "contour" ? 2 : 1.4,
        area: Math.round(comp.area * scaleX * scaleY),
        centroid,
        hint: buildHint(layer, areaFraction, meanRgb, pos),
      },
    });
  }

  // Big forms first, then progressively smaller detail.
  built.sort((a, b) => b.area - a.area);
  const limited = built.slice(0, o.maxStrokes);

  const strokes: Stroke[] = limited.map((b, i) => ({ id: i, ...b.stroke }));

  return { width: sourceWidth, height: sourceHeight, strokes };
}
