import { generateStrokePlan } from "../lib/pipeline.ts";
import { generatePainting } from "../lib/painterly.ts";
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
const dabsOnly = painting.strokes.filter((s) => s.kind === "dab");
const linesOnly = painting.strokes.filter((s) => s.kind === "line");
check(
  "dabs have positive size + valid colour",
  dabsOnly.every((s) => s.length > 0 && s.width > 0 && /^#[0-9a-f]{6}$/.test(s.color)),
);
check("line work was produced", linesOnly.length >= 1);
check(
  "line strokes carry a polyline",
  linesOnly.every((s) => Array.isArray(s.points) && s.points!.length >= 2),
);
check("line work is drawn last", linesOnly.every((s, i) =>
  i === 0 ? true : s.id > linesOnly[i - 1].id) &&
  (linesOnly.length === 0 || linesOnly[0].id >= dabsOnly.length - 1));
check(
  "opacity within range",
  painting.strokes.every((s) => s.opacity > 0 && s.opacity <= 1),
);
check("brush hints non-empty", painting.strokes.every((s) => s.hint.length > 0));
check("respects dab cap", dabsOnly.length <= PAINTERLY_PRESETS.balanced.maxStrokes);

console.log("\nsample brush:", JSON.stringify(painting.strokes[0]).slice(0, 300));
console.log(ok ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(ok ? 0 : 1);
