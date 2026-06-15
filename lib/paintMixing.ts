/**
 * Deterministic paint-mixing guidance — no LLM, no cost.
 *
 * Given a target colour, fit it to a small recipe of standard artist pigments
 * using a per-channel Kubelka-Munk subtractive-mixing approximation (the model
 * used for real pigment mixing, not the additive RGB average that makes paint
 * look wrong). Returns pigment proportions plus value/temperature notes and a
 * medium-specific tip. The paid AI tier will later narrate these recipes; the
 * recipe itself is computed here for free.
 */

export type Medium = "watercolour" | "acrylic";

export interface MixPart {
  name: string;
  hex: string;
  pct: number;
}

export interface MixRecipe {
  parts: MixPart[];
  /** Colour the recipe actually produces — for an "≈" preview swatch. */
  mixedHex: string;
  value: "light" | "mid" | "dark";
  temperature: "warm" | "cool" | "neutral";
  note: string;
  /** Fit quality (CIE76 ΔE) — lower is closer. */
  deltaE: number;
}

interface Pigment {
  name: string;
  hex: string;
  /** Per-channel Kubelka-Munk K/S, precomputed from the swatch. */
  ks: [number, number, number];
}

const PALETTE_DEF: { name: string; hex: string }[] = [
  { name: "Titanium White", hex: "#f7f7f2" },
  { name: "Lemon Yellow", hex: "#f6e500" },
  { name: "Cadmium Yellow", hex: "#ffc20c" },
  { name: "Yellow Ochre", hex: "#c68e3a" },
  { name: "Cadmium Red", hex: "#e3242b" },
  { name: "Alizarin Crimson", hex: "#9e1b32" },
  { name: "Burnt Sienna", hex: "#8a3324" },
  { name: "Raw Umber", hex: "#6b4f36" },
  { name: "Ultramarine Blue", hex: "#2b3a8c" },
  { name: "Phthalo Blue", hex: "#123a6b" },
  { name: "Sap Green", hex: "#4a6e20" },
  { name: "Ivory Black", hex: "#1c1c1c" },
];

// ── Colour-space helpers ──────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const x = Math.max(0, Math.min(1, v));
  const c = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(c * 255);
}

function linearToXyz([r, g, b]: [number, number, number]): [number, number, number] {
  return [
    r * 0.4124 + g * 0.3576 + b * 0.1805,
    r * 0.2126 + g * 0.7152 + b * 0.0722,
    r * 0.0193 + g * 0.1192 + b * 0.9505,
  ];
}

function xyzToLab([x, y, z]: [number, number, number]): [number, number, number] {
  // D65 reference white.
  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function linearToLab(lin: [number, number, number]): [number, number, number] {
  return xyzToLab(linearToXyz(lin));
}

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ── Kubelka-Munk mixing ───────────────────────────────────────────────────
function ksOf(reflectance: number): number {
  const r = Math.min(0.995, Math.max(0.005, reflectance));
  return ((1 - r) * (1 - r)) / (2 * r);
}

function ksToReflectance(k: number): number {
  return 1 + k - Math.sqrt(k * k + 2 * k);
}

const PALETTE: Pigment[] = PALETTE_DEF.map((p) => {
  const [r, g, b] = hexToRgb(p.hex);
  return {
    name: p.name,
    hex: p.hex,
    ks: [ksOf(srgbToLinear(r)), ksOf(srgbToLinear(g)), ksOf(srgbToLinear(b))],
  };
});

/** Mix pigments by weight → resulting linear-RGB reflectance. */
function mixLinear(indices: number[], weights: number[]): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    let ks = 0;
    for (let i = 0; i < indices.length; i++) ks += weights[i] * PALETTE[indices[i]].ks[c];
    out[c] = ksToReflectance(ks);
  }
  return out;
}

// ── Recipe phrasing ───────────────────────────────────────────────────────
function valueOf(hex: string): MixRecipe["value"] {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 75 ? "dark" : lum < 160 ? "mid" : "light";
}

function temperatureOf(hex: string): MixRecipe["temperature"] {
  const [r, g, b] = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 22) return "neutral"; // low saturation
  let h = 0;
  if (max === r) h = (60 * ((g - b) / (max - min)) + 360) % 360;
  else if (max === g) h = 60 * ((b - r) / (max - min)) + 120;
  else h = 60 * ((r - g) / (max - min)) + 240;
  return h < 90 || h >= 290 ? "warm" : "cool";
}

function note(medium: Medium, hasWhite: boolean): string {
  if (medium === "watercolour") {
    return hasWhite
      ? "Watercolour: don't reach for white — dilute with water and reserve the paper for your lightest areas."
      : "Watercolour: build in thin transparent washes, saving the darkest accents for last.";
  }
  return hasWhite
    ? "Acrylic/oil: mix opaque and add the white last, adjusting until the value matches."
    : "Acrylic/oil: start from a transparent base and deepen with glazes.";
}

// ── Search ────────────────────────────────────────────────────────────────
function snap(indices: number[], weights: number[]): MixPart[] {
  return indices
    .map((idx, i) => ({
      name: PALETTE[idx].name,
      hex: PALETTE[idx].hex,
      pct: Math.round(weights[i] * 100),
    }))
    .filter((p) => p.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

const cache = new Map<string, MixRecipe>();

/**
 * Best small pigment recipe for a target colour. Searches 1-, 2- and 3-pigment
 * combinations on a 10% weight grid, biased toward simpler mixes.
 */
export function mixRecipe(targetHex: string, medium: Medium): MixRecipe {
  const key = `${targetHex}|${medium}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const [tr, tg, tb] = hexToRgb(targetHex);
  const targetLab = linearToLab([srgbToLinear(tr), srgbToLinear(tg), srgbToLinear(tb)]);

  // Light per-pigment penalty so we prefer simpler mixes only when they fit
  // about as well — not at the cost of a visibly wrong colour.
  const PENALTY = 0.6;
  let best: { indices: number[]; weights: number[]; raw: number; adj: number } | null = null;
  const consider = (indices: number[], weights: number[]) => {
    const lin = mixLinear(indices, weights);
    const raw = deltaE(linearToLab(lin), targetLab);
    const adj = raw + PENALTY * (indices.length - 1);
    if (!best || adj < best.adj) best = { indices, weights, raw, adj };
  };

  const n = PALETTE.length;
  // Singles
  for (let i = 0; i < n; i++) consider([i], [1]);
  // Pairs — 5% grid so pale tints (95% white + 5% colour) are reachable.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let a = 1; a <= 19; a++) consider([i, j], [a / 20, (20 - a) / 20]);
    }
  }
  // Triples
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let a = 1; a <= 8; a++) {
          for (let b = 1; b <= 9 - a; b++) {
            consider([i, j, k], [a / 10, b / 10, (10 - a - b) / 10]);
          }
        }
      }
    }
  }

  const chosen = best!;
  const lin = mixLinear(chosen.indices, chosen.weights);
  const mixedHex = `#${[lin[0], lin[1], lin[2]]
    .map((v) => linearToSrgb(v).toString(16).padStart(2, "0"))
    .join("")}`;
  const parts = snap(chosen.indices, chosen.weights);
  const hasWhite = parts.some((p) => p.name === "Titanium White");

  const recipe: MixRecipe = {
    parts,
    mixedHex,
    value: valueOf(targetHex),
    temperature: temperatureOf(targetHex),
    note: note(medium, hasWhite),
    deltaE: Math.round(chosen.raw * 10) / 10,
  };
  cache.set(key, recipe);
  return recipe;
}
