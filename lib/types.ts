export type Point = [number, number];

/** Which pedagogical stage a stroke belongs to. Big forms are blocked in
 *  first, then contours, then small detail — the order an artist actually
 *  builds a drawing. */
export type Layer = "block" | "contour" | "detail";

export interface Stroke {
  /** Stable draw order index (0 = first stroke the learner makes). */
  id: number;
  layer: Layer;
  /** Simplified polyline in source-image pixel coordinates. */
  path: Point[];
  /** Whether the path closes back on itself (region outline) or is open. */
  closed: boolean;
  /** Representative region colour, sampled from the source image (hex). */
  color: string;
  /** Suggested pen/brush width in source-image pixels. */
  width: number;
  /** Region area in source-image pixels (drives ordering + layering). */
  area: number;
  /** Approximate centroid of the region, in source-image pixels. */
  centroid: Point;
  /** Human-readable teaching narration for this stroke. */
  hint: string;
}

export interface StrokePlan {
  /** Source-image dimensions the stroke coordinates are expressed in. */
  width: number;
  height: number;
  /** Ordered strokes — index 0 is drawn first. */
  strokes: Stroke[];
}

export interface PipelineOptions {
  /** Longest edge the image is downscaled to before processing (speed/quality). */
  maxDimension: number;
  /** Number of colour clusters to quantise the image into. */
  colors: number;
  /** Douglas-Peucker tolerance, in processed-image pixels. */
  simplifyTolerance: number;
  /** Drop regions smaller than this fraction of the total image area. */
  minAreaFraction: number;
  /** Hard cap on the number of strokes (largest regions kept). */
  maxStrokes: number;
}

export const DEFAULT_OPTIONS: PipelineOptions = {
  maxDimension: 320,
  colors: 12,
  simplifyTolerance: 1.6,
  minAreaFraction: 0.0006,
  maxStrokes: 350,
};
