import { generateStrokePlan } from "../lib/pipeline.ts";
import { generatePainting } from "../lib/painterly.ts";
import { mixRecipe } from "../lib/paintMixing.ts";
import { prepareImage } from "../lib/preprocess.ts";
import { PAINTERLY_PRESETS } from "../lib/types.ts";

// Build a synthetic 80x80 image: cream background, a red square, a blue disc.
const W = 80;
const H = 80;
const data = new Uint8ClampedArray(W * H * 4);
function set(x: number, y: number, r: number, g: number, b: number) {
  const p = (y * W + x) * 4;
  data[p] = r;
  data[p + 1] = g;
  data[p + 2] = b;
  data[p + 3] = 255;
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    set(x, y, 225, 215, 185); // cream bg
    if (x >= 10 && x < 35 && y >= 10 && y < 35) set(x, y, 200, 40, 40); // red square
    const dx = x - 55;
    const dy = y - 55;
    if (dx * dx + dy * dy < 15 * 15) set(x, y, 50, 80, 190); // blue disc
  }
}

const imageData = { data, width: W, height: H } as ImageData;
const plan = generateStrokePlan(imageData, W, H);

console.log("strokes:", plan.strokes.length);
let ok = true;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) ok = false;
}

check("produced strokes", plan.strokes.length >= 3);
check("plan dimensions match", plan.width === W && plan.height === H);
check("ordered largest-first", plan.strokes.every((s, i) =>
  i === 0 ? true : plan.strokes[i - 1].area >= s.area));
check("strokes carry ids in order", plan.strokes.every((s, i) => s.id === i));
check("paths have >=2 points", plan.strokes.every((s) => s.path.length >= 2));
check("colors are hex", plan.strokes.every((s) => /^#[0-9a-f]{6}$/.test(s.color)));
check("hints non-empty", plan.strokes.every((s) => s.hint.length > 0));

// The red square and blue disc should each surface as a stroke whose colour is
// recognisably red / blue.
const reds = plan.strokes.filter((s) => {
  const r = parseInt(s.color.slice(1, 3), 16);
  const b = parseInt(s.color.slice(5, 7), 16);
  return r > 150 && b < 100;
});
const blues = plan.strokes.filter((s) => {
  const r = parseInt(s.color.slice(1, 3), 16);
  const b = parseInt(s.color.slice(5, 7), 16);
  return b > 150 && r < 120;
});
check("found a red region", reds.length >= 1);
check("found a blue region", blues.length >= 1);

// ─── Painterly engine ────────────────────────────────────────────────────────
console.log("\n--- painterly ---");
const painting = generatePainting(imageData, W, H, PAINTERLY_PRESETS.balanced);
console.log("brush strokes:", painting.strokes.length);

check("painting produced strokes", painting.strokes.length >= 5);
check("painting dimensions match", painting.width === W && painting.height === H);
check("background is hex", /^#[0-9a-f]{6}$/.test(painting.background));
check(
  "coarse-to-fine ordering (levels non-decreasing)",
  painting.strokes.every((s, i) => (i === 0 ? true : painting.strokes[i - 1].level <= s.level)),
);
check("brush ids in order", painting.strokes.every((s, i) => s.id === i));
check(
  "brushes have positive size + valid colour",
  painting.strokes.every(
    (s) => s.length > 0 && s.width > 0 && /^#[0-9a-f]{6}$/.test(s.color),
  ),
);
check(
  "opacity within range",
  painting.strokes.every((s) => s.opacity > 0 && s.opacity <= 1),
);
check("brush hints non-empty", painting.strokes.every((s) => s.hint.length > 0));
check("respects stroke cap", painting.strokes.length <= PAINTERLY_PRESETS.balanced.maxStrokes);

console.log("\nsample brush:", JSON.stringify(painting.strokes[0]).slice(0, 300));

// ─── Paint-mixing engine ─────────────────────────────────────────────────────
console.log("\n--- paint mixing ---");
const samples = ["#e3242b", "#2b3a8c", "#c68e3a", "#f0e8d0", "#1c1c1c"];
for (const hex of samples) {
  const r = mixRecipe(hex, "watercolour");
  const pctSum = r.parts.reduce((a, p) => a + p.pct, 0);
  console.log(`  ${hex} -> ${r.parts.map((p) => `${p.pct}% ${p.name}`).join(" + ")} (ΔE ${r.deltaE})`);
  check(`${hex}: parts present`, r.parts.length >= 1 && r.parts.length <= 3);
  check(`${hex}: percentages sum to 100`, pctSum === 100);
  check(`${hex}: mixed colour is hex`, /^#[0-9a-f]{6}$/.test(r.mixedHex));
  check(`${hex}: reasonable fit (ΔE < 18)`, r.deltaE < 18);
  check(`${hex}: note + value + temperature set`,
    r.note.length > 0 && !!r.value && !!r.temperature);
}
// Medium changes the guidance text.
check("medium changes the note",
  mixRecipe("#f0e8d0", "watercolour").note !== mixRecipe("#f0e8d0", "acrylic").note);
// Deterministic.
check("deterministic", mixRecipe("#e3242b", "acrylic").mixedHex === mixRecipe("#e3242b", "acrylic").mixedHex);

// ─── Pre-processing (crop + background removal) ──────────────────────────────
console.log("\n--- preprocess ---");
{
  // White field with a red disc in the centre (not touching the border).
  const PW = 100, PH = 100;
  const pdata = new Uint8ClampedArray(PW * PH * 4);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const p = (y * PW + x) * 4;
    const dx = x - 50, dy = y - 50;
    const inside = dx * dx + dy * dy < 25 * 25;
    pdata[p] = inside ? 200 : 240;
    pdata[p + 1] = inside ? 40 : 240;
    pdata[p + 2] = inside ? 40 : 240;
    pdata[p + 3] = 255;
  }
  const srcImg = { data: pdata, width: PW, height: PH };
  const sample = (img: { data: Uint8ClampedArray; width: number }, x: number, y: number) => {
    const p = (y * img.width + x) * 4;
    return [img.data[p], img.data[p + 1], img.data[p + 2]];
  };

  const noop = prepareImage(srcImg, { x: 0, y: 0, w: 1, h: 1 }, false, 0);
  check("no-op preserves dimensions", noop.width === PW && noop.height === PH);

  const bgRemoved = prepareImage(srcImg, { x: 0, y: 0, w: 1, h: 1 }, true, 30);
  const [cr, cg, cb] = sample(bgRemoved, 50, 50);
  const [er, eg, eb] = sample(bgRemoved, 2, 2);
  check("subject kept (centre still red)", cr > 150 && cg < 100 && cb < 100);
  check("background whitened (corner ~white)", er > 245 && eg > 245 && eb > 245);

  const cropped = prepareImage(srcImg, { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, false, 0);
  check("crop resizes", cropped.width === 40 && cropped.height === 40);
  const [mr, mg, mb] = sample(cropped, 20, 20);
  check("crop centres on subject (red)", mr > 150 && mg < 100 && mb < 100);
}

console.log(ok ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
