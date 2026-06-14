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
  /** Gaussian blur sigma applied before quantisation, to merge texture noise. */
  blurSigma: number;
  /** Majority-filter passes over the label map, to despeckle regions. */
  smoothingPasses: number;
  /** Number of colour clusters to quantise the image into. */
  colors: number;
  /** Douglas-Peucker tolerance, in processed-image pixels. */
  simplifyTolerance: number;
  /** Drop regions smaller than this fraction of the total image area. */
  minAreaFraction: number;
  /** Hard cap on the number of strokes (largest regions kept). */
  maxStrokes: number;
}

/** How busy the resulting lesson should be. Simpler levels blur harder, use
 *  fewer colours and a higher minimum region size, so a photo resolves into a
 *  teachable handful of shapes rather than confetti. */
export type DetailLevel = "simple" | "balanced" | "detailed";

export const DETAIL_PRESETS: Record<DetailLevel, PipelineOptions> = {
  simple: {
    maxDimension: 300,
    blurSigma: 2.4,
    smoothingPasses: 2,
    colors: 7,
    simplifyTolerance: 2.4,
    minAreaFraction: 0.004,
    maxStrokes: 80,
  },
  balanced: {
    maxDimension: 320,
    blurSigma: 1.6,
    smoothingPasses: 1,
    colors: 10,
    simplifyTolerance: 1.9,
    minAreaFraction: 0.0018,
    maxStrokes: 160,
  },
  detailed: {
    maxDimension: 360,
    blurSigma: 1.0,
    smoothingPasses: 1,
    colors: 14,
    simplifyTolerance: 1.4,
    minAreaFraction: 0.0008,
    maxStrokes: 300,
  },
};

export const DEFAULT_OPTIONS: PipelineOptions = DETAIL_PRESETS.balanced;
