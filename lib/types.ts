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

/** A single brush mark. Most are oriented `dab`s laid coarse-to-fine; a final
 *  band of `line` strokes inks the major contours for definition. */
export interface BrushStroke {
  id: number;
  /** "dab" = filled brush mark; "line" = a drawn contour polyline. */
  kind: "dab" | "line";
  /** Centre in source-image pixels. */
  x: number;
  y: number;
  /** Major axis (length along the stroke direction), source-image pixels. */
  length: number;
  /** Minor axis (brush width), or line thickness for `line` kind. */
  width: number;
  /** Orientation in radians, aligned to local image structure (dabs only). */
  angle: number;
  /** Brush colour, sampled from the target image (hex). */
  color: string;
  /** Paint opacity 0..1. */
  opacity: number;
  /** Coarse-to-fine pass index (0 = broadest; line work comes last). */
  level: number;
  /** Pedagogical band label for the lesson panel. */
  band: string;
  /** Teaching narration for this stroke. */
  hint: string;
  /** Polyline in source-image pixels — present for `line` kind. */
  points?: [number, number][];
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
  /** Hard cap on dab strokes. */
  maxStrokes: number;
  /** Whether to ink the major contours as a final definition pass. */
  lineWork: boolean;
  /** Colour clusters used to derive contour lines (coarser = bolder shapes). */
  lineColors: number;
  /** Drop contour regions smaller than this fraction of the image. */
  lineMinAreaFraction: number;
  /** Hard cap on contour line strokes. */
  lineMaxStrokes: number;
  /** Line thickness in processed-image pixels. */
  lineWidth: number;
}

export const PAINTERLY_PRESETS: Record<DetailLevel, PainterlyOptions> = {
  simple: {
    maxDimension: 340,
    sampleBlur: 0.7,
    levels: 6,
    coarsestFraction: 0.09,
    finestPx: 3,
    lengthRatio: 1.8,
    spacing: 0.45,
    errorThreshold: 300,
    maxStrokes: 600,
    lineWork: true,
    lineColors: 6,
    lineMinAreaFraction: 0.004,
    lineMaxStrokes: 45,
    lineWidth: 1.7,
  },
  balanced: {
    maxDimension: 380,
    sampleBlur: 0.6,
    levels: 7,
    coarsestFraction: 0.08,
    finestPx: 2.2,
    lengthRatio: 1.8,
    spacing: 0.42,
    errorThreshold: 190,
    maxStrokes: 1300,
    lineWork: true,
    lineColors: 7,
    lineMinAreaFraction: 0.0025,
    lineMaxStrokes: 75,
    lineWidth: 1.5,
  },
  detailed: {
    maxDimension: 420,
    sampleBlur: 0.45,
    levels: 8,
    coarsestFraction: 0.07,
    finestPx: 1.8,
    lengthRatio: 1.75,
    spacing: 0.4,
    errorThreshold: 120,
    maxStrokes: 2600,
    lineWork: true,
    lineColors: 8,
    lineMinAreaFraction: 0.0015,
    lineMaxStrokes: 120,
    lineWidth: 1.3,
  },
};

export type RenderMode = "outline" | "painterly";
