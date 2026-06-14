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

// ─── Painterly (stroke-based rendering) ──────────────────────────────────────

/** A single oriented brush dab. Strokes are emitted coarse-to-fine, so index 0
 *  is the broadest base mass and later strokes are fine accents. */
export interface BrushStroke {
  id: number;
  /** Centre in source-image pixels. */
  x: number;
  y: number;
  /** Major axis (length along the stroke direction), source-image pixels. */
  length: number;
  /** Minor axis (brush width), source-image pixels. */
  width: number;
  /** Orientation in radians, aligned to local image structure. */
  angle: number;
  /** Brush colour, sampled from the target image (hex). */
  color: string;
  /** Paint opacity 0..1. */
  opacity: number;
  /** Coarse-to-fine pass index (0 = broadest). */
  level: number;
  /** Pedagogical band label for the lesson panel. */
  band: string;
  /** Teaching narration for this stroke. */
  hint: string;
}

export interface PaintingPlan {
  width: number;
  height: number;
  /** Canvas tone the strokes are laid over (hex) — the image's mean colour. */
  background: string;
  strokes: BrushStroke[];
}

export interface PainterlyOptions {
  maxDimension: number;
  /** Light blur before sampling colour/structure, to calm noise. */
  sampleBlur: number;
  /** Number of coarse-to-fine passes. */
  levels: number;
  /** Coarsest brush width as a fraction of the longest edge. */
  coarsestFraction: number;
  /** Finest brush width in processed-image pixels. */
  finestPx: number;
  /** Stroke length as a multiple of brush width. */
  lengthRatio: number;
  /** Grid spacing as a fraction of brush width (<1 overlaps). */
  spacing: number;
  /** Per-channel mean-squared error below which a cell is left alone. */
  errorThreshold: number;
  /** Hard cap on total strokes. */
  maxStrokes: number;
}

export const PAINTERLY_PRESETS: Record<DetailLevel, PainterlyOptions> = {
  simple: {
    maxDimension: 320,
    sampleBlur: 0.9,
    levels: 5,
    coarsestFraction: 0.12,
    finestPx: 5,
    lengthRatio: 2.0,
    spacing: 0.5,
    errorThreshold: 650,
    maxStrokes: 380,
  },
  balanced: {
    maxDimension: 360,
    sampleBlur: 0.7,
    levels: 6,
    coarsestFraction: 0.1,
    finestPx: 3.2,
    lengthRatio: 2.0,
    spacing: 0.45,
    errorThreshold: 380,
    maxStrokes: 900,
  },
  detailed: {
    maxDimension: 400,
    sampleBlur: 0.5,
    levels: 7,
    coarsestFraction: 0.085,
    finestPx: 2.2,
    lengthRatio: 2.1,
    spacing: 0.42,
    errorThreshold: 230,
    maxStrokes: 2000,
  },
};

export type RenderMode = "outline" | "painterly";
