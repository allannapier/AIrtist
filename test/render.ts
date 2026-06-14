import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { generatePainting } from "../lib/painterly.ts";
import { PAINTERLY_PRESETS } from "../lib/types.ts";

// Synthetic "pint on a table" with sharp features to test stroke definition:
// dark background, an amber glass with a crisp white foam band, table planks.
const W = 300;
const H = 400;
const src = new Uint8ClampedArray(W * H * 4);
function set(x: number, y: number, r: number, g: number, b: number) {
  const p = (y * W + x) * 4;
  src[p] = r;
  src[p + 1] = g;
  src[p + 2] = b;
  src[p + 3] = 255;
}
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // background
    let r = 45, g = 47, b = 55;
    // table (bottom 45%)
    if (y > H * 0.55) {
      r = 95; g = 82; b = 70;
      if (Math.floor((y - H * 0.55) / 26) % 2 === 0) { r -= 18; g -= 16; b -= 14; }
      if ((y - Math.floor(H * 0.55)) % 26 < 2) { r = 40; g = 34; b = 30; } // plank line
    }
    // glass
    if (x >= 110 && x < 192 && y >= 120 && y < 332) {
      const t = (y - 120) / (332 - 120);
      r = 235 - 40 * t; g = 180 - 45 * t; b = 45 - 20 * t; // amber gradient
      if (y < 150) { r = 236; g = 234; b = 224; } // crisp foam band
    }
    // dark ashtray left
    const dx = x - 70, dy = y - 250;
    if (dx * dx + dy * dy < 26 * 26) { r = 30; g = 30; b = 32; }
    set(x, y, r, g, b);
  }
}
const imageData = { data: src, width: W, height: H } as ImageData;

function rasterize(planStrokes: ReturnType<typeof generatePainting>): Buffer {
  const plan = planStrokes;
  const fr = new Float32Array(W * H);
  const fg = new Float32Array(W * H);
  const fb = new Float32Array(W * H);
  const bg = [
    parseInt(plan.background.slice(1, 3), 16),
    parseInt(plan.background.slice(3, 5), 16),
    parseInt(plan.background.slice(5, 7), 16),
  ];
  fr.fill(bg[0]); fg.fill(bg[1]); fb.fill(bg[2]);
  for (const s of plan.strokes) {
    const cos = Math.cos(s.angle), sin = Math.sin(s.angle);
    const a = s.length / 2, bb = s.width / 2;
    const col = [
      parseInt(s.color.slice(1, 3), 16),
      parseInt(s.color.slice(3, 5), 16),
      parseInt(s.color.slice(5, 7), 16),
    ];
    const reach = Math.ceil(Math.max(a, bb));
    for (let oy = -reach; oy <= reach; oy++) {
      const yy = Math.round(s.y) + oy;
      if (yy < 0 || yy >= H) continue;
      for (let ox = -reach; ox <= reach; ox++) {
        const xx = Math.round(s.x) + ox;
        if (xx < 0 || xx >= W) continue;
        const u = ox * cos + oy * sin, v = -ox * sin + oy * cos;
        const d = (u * u) / (a * a) + (v * v) / (bb * bb);
        if (d > 1) continue;
        const rr = Math.sqrt(d);
        const fall = rr < 0.65 ? 1 : (1 - rr) / 0.35;
        const alpha = s.opacity * fall;
        if (alpha <= 0) continue;
        const i = yy * W + xx;
        fr[i] = fr[i] * (1 - alpha) + col[0] * alpha;
        fg[i] = fg[i] * (1 - alpha) + col[1] * alpha;
        fb[i] = fb[i] * (1 - alpha) + col[2] * alpha;
      }
    }
  }
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) {
    png.data[i * 4] = fr[i];
    png.data[i * 4 + 1] = fg[i];
    png.data[i * 4 + 2] = fb[i];
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

// Source reference
const srcPng = new PNG({ width: W, height: H });
srcPng.data.set(src);
writeFileSync("/tmp/source.png", PNG.sync.write(srcPng));

const plan = generatePainting(imageData, W, H, PAINTERLY_PRESETS.detailed);
console.log("detailed strokes:", plan.strokes.length);
writeFileSync("/tmp/painted.png", rasterize(plan));
console.log("wrote /tmp/source.png and /tmp/painted.png");
