# AIrtist

Upload an image and AIrtist breaks it into an **ordered sequence of strokes** you can
follow to draw it yourself — big forms first, then contours, then fine detail, the way an
artist actually builds up a drawing.

Everything runs **in the browser**: images never leave your device, no GPU and no server
inference required.

## How it works

The stroke plan is produced by a classic computer-vision pipeline (no ML, fully
deterministic):

1. **Downscale** the image to a working resolution (longest edge ≤ 320px) while keeping
   original dimensions for the final coordinates.
2. **k-means colour quantisation** clusters the image into a small palette (`lib/quantize.ts`).
3. **Connected-component labelling** finds each fillable colour region (`lib/components.ts`).
4. **Moore-neighbour boundary tracing** walks the outline of every region (`lib/trace.ts`).
5. **Douglas-Peucker simplification** reduces each outline to meaningful vertices
   (`lib/simplify.ts`).
6. **Ordering** sorts strokes largest-area first and tags each with a pedagogical layer
   — `block` → `contour` → `detail` (`lib/pipeline.ts`).

Each stroke carries its region colour (sampled from the source), a suggested width, a
centroid, and a human-readable teaching hint.

## Stroke schema

```ts
interface StrokePlan {
  width: number;          // source-image dimensions the coords use
  height: number;
  strokes: Stroke[];      // index 0 is drawn first
}

interface Stroke {
  id: number;
  layer: "block" | "contour" | "detail";
  path: [number, number][]; // polyline in source-image pixels
  closed: boolean;
  color: string;            // hex, sampled from the region
  width: number;
  area: number;
  centroid: [number, number];
  hint: string;             // teaching narration
}
```

You can export the plan for any image with the **Download plan (JSON)** button — useful if
you want to drive a different renderer or build on top of it.

## The renderer

`components/StrokeCanvas.tsx` replays the plan as SVG paths, revealing each stroke
progressively via `stroke-dashoffset` over a `pathLength`-normalised path. A timeline
scrubber, play/pause, per-stroke stepping, speed control, optional watercolour-style
colour fill, and a ghost of the upcoming stroke are wired up in `app/page.tsx`.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build + type check
npm test         # pipeline smoke test (synthetic image)
```

## Roadmap

This is the MVP (the "Approach 1" decomposition). Because the renderer consumes a plain
ordered stroke list, the generator can be swapped without touching the UI:

- **Salience-aware layering** — SAM2 segmentation to drive blocking + per-region detail.
- **Stroke-based ML** — Paint Transformer / differentiable rendering for painterly,
  learned stroke order (a natural fit for watercolour subjects).
- **VLM narration** — a vision model attaching colour/technique notes per region for
  richer teaching hints.
