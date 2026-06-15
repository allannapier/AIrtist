export type Point = [number, number];

/** A bare RGBA pixel buffer. Both the browser's ImageData and our own
 *  pre-processing buffers satisfy this, so the pipeline accepts either. */
export interface PixelImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

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
export type DetailLevel =
  | "simple"
  | "balanced"
  | "detailed"
  | "fine"
  | "intricate"
  | "extreme";

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
  fine: {
    maxDimension: 380,
    blurSigma: 0.8,
    smoothingPasses: 1,
    colors: 16,
    simplifyTolerance: 1.2,
    minAreaFraction: 0.0005,
    maxStrokes: 550,
  },
  intricate: {
    maxDimension: 400,
    blurSigma: 0.6,
    smoothingPasses: 0,
    colors: 20,
    simplifyTolerance: 1.0,
    minAreaFraction: 0.00035,
    maxStrokes: 850,
  },
  extreme: {
    maxDimension: 420,
    blurSigma: 0.5,
    smoothingPasses: 0,
    colors: 24,
    simplifyTolerance: 0.9,
    minAreaFraction: 0.00022,
    maxStrokes: 1300,
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
    maxDimension: 360,
    sampleBlur: 0.6,
    levels: 6,
    coarsestFraction: 0.08,
    finestPx: 2.2,
    lengthRatio: 1.8,
    spacing: 0.42,
    errorThreshold: 200,
    maxStrokes: 1800,
  },
  balanced: {
    maxDimension: 400,
    sampleBlur: 0.5,
    levels: 7,
    coarsestFraction: 0.07,
    finestPx: 1.8,
    lengthRatio: 1.75,
    spacing: 0.4,
    errorThreshold: 150,
    maxStrokes: 3500,
  },
  detailed: {
    maxDimension: 460,
    sampleBlur: 0.4,
    levels: 8,
    coarsestFraction: 0.06,
    finestPx: 1.4,
    lengthRatio: 1.7,
    spacing: 0.4,
    errorThreshold: 110,
    maxStrokes: 6000,
  },
  fine: {
    maxDimension: 480,
    sampleBlur: 0.35,
    levels: 9,
    coarsestFraction: 0.05,
    finestPx: 1.2,
    lengthRatio: 1.7,
    spacing: 0.38,
    errorThreshold: 75,
    maxStrokes: 9000,
  },
  intricate: {
    maxDimension: 500,
    sampleBlur: 0.3,
    levels: 10,
    coarsestFraction: 0.045,
    finestPx: 1.1,
    lengthRatio: 1.65,
    spacing: 0.36,
    errorThreshold: 50,
    maxStrokes: 12000,
  },
  extreme: {
    maxDimension: 520,
    sampleBlur: 0.3,
    levels: 11,
    coarsestFraction: 0.04,
    finestPx: 1.0,
    lengthRatio: 1.6,
    spacing: 0.34,
    errorThreshold: 32,
    maxStrokes: 16000,
  },
};

export type RenderMode = "outline" | "painterly";
