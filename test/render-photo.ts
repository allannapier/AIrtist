import sharp from "sharp";
import { generatePainting } from "../lib/painterly.ts";
import { PAINTERLY_PRESETS, type DetailLevel, type PaintingPlan } from "../lib/types.ts";

const INPUT = process.argv[2] ?? "test/pint.jpg";
const MAX = 400;

function rasterize(plan: PaintingPlan, W: number, H: number): Buffer {
  const fr = new Float32Array(W * H);
  const fg = new Float32Array(W * H);
  const fb = new Float32Array(W * H);
  const hx = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  fr.fill(hx(plan.background, 1));
  fg.fill(hx(plan.background, 3));
  fb.fill(hx(plan.background, 5));

  const stamp = (cx: number, cy: number, rad: number, col: number[], op: number) => {
    const reach = Math.ceil(rad);
    for (let oy = -reach; oy <= reach; oy++) {
      const yy = cy + oy;
      if (yy < 0 || yy >= H) continue;
      for (let ox = -reach; ox <= reach; ox++) {
        const xx = ox + cx;
        if (xx < 0 || xx >= W) continue;
        if (ox * ox + oy * oy > rad * rad) continue;
        const i = yy * W + xx;
        fr[i] = fr[i] * (1 - op) + col[0] * op;
        fg[i] = fg[i] * (1 - op) + col[1] * op;
        fb[i] = fb[i] * (1 - op) + col[2] * op;
      }
    }
  };

  for (const s of plan.strokes) {
    const col = [hx(s.color, 1), hx(s.color, 3), hx(s.color, 5)];
    if (s.kind === "line" && s.points) {
      const rad = Math.max(0.6, s.width / 2);
      for (let k = 1; k < s.points.length; k++) {
        const [x0, y0] = s.points[k - 1];
        const [x1, y1] = s.points[k];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(len / 0.7));
        for (let t = 0; t <= steps; t++) {
          const f = t / steps;
          stamp(Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f), rad, col, s.opacity);
        }
      }
      continue;
    }
    const cos = Math.cos(s.angle);
    const sin = Math.sin(s.angle);
    const a = s.length / 2;
    const bb = s.width / 2;
    const reach = Math.ceil(Math.max(a, bb));
    const sx = Math.round(s.x);
    const sy = Math.round(s.y);
    for (let oy = -reach; oy <= reach; oy++) {
      const yy = sy + oy;
      if (yy < 0 || yy >= H) continue;
      for (let ox = -reach; ox <= reach; ox++) {
        const xx = sx + ox;
        if (xx < 0 || xx >= W) continue;
        const u = ox * cos + oy * sin;
        const v = -ox * sin + oy * cos;
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

  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    out[i * 4] = fr[i];
    out[i * 4 + 1] = fg[i];
    out[i * 4 + 2] = fb[i];
    out[i * 4 + 3] = 255;
  }
  return out;
}

async function main() {
  const { data, info } = await sharp(INPUT)
    .rotate() // honour EXIF orientation
    .resize(MAX, MAX, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  console.log(`source ${W}x${H}`);

  await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile("/tmp/pint_src.png");

  const imageData = { data: new Uint8ClampedArray(data), width: W, height: H } as ImageData;

  for (const level of ["simple", "balanced", "detailed"] as DetailLevel[]) {
    const t0 = Date.now();
    const plan = generatePainting(imageData, W, H, PAINTERLY_PRESETS[level]);
    const ms = Date.now() - t0;
    const raster = rasterize(plan, W, H);
    await sharp(raster, { raw: { width: W, height: H, channels: 4 } })
      .png()
      .toFile(`/tmp/pint_${level}.png`);
    console.log(`${level}: ${plan.strokes.length} strokes, ${ms}ms -> /tmp/pint_${level}.png`);
  }

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
