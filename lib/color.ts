export type RGB = [number, number, number];

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): RGB {
  const v = hex.replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

/** Multiply an RGB colour toward black — used to render outlines a touch
 *  darker than the region fill, the way a pencil line reads against wash. */
export function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * factor, g * factor, b * factor]);
}

export function luminance([r, g, b]: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const NAMED: { name: string; rgb: RGB }[] = [
  { name: "white", rgb: [245, 245, 245] },
  { name: "black", rgb: [20, 20, 20] },
  { name: "grey", rgb: [128, 128, 128] },
  { name: "red", rgb: [200, 40, 40] },
  { name: "rose pink", rgb: [225, 120, 150] },
  { name: "orange", rgb: [230, 140, 40] },
  { name: "warm yellow", rgb: [235, 205, 70] },
  { name: "olive", rgb: [130, 140, 60] },
  { name: "green", rgb: [60, 150, 70] },
  { name: "teal", rgb: [50, 150, 150] },
  { name: "sky blue", rgb: [110, 170, 220] },
  { name: "blue", rgb: [50, 80, 190] },
  { name: "violet", rgb: [130, 80, 180] },
  { name: "brown", rgb: [120, 80, 50] },
  { name: "cream", rgb: [225, 215, 185] },
];

/** Nearest human colour name, for the teaching narration. */
export function colorName(rgb: RGB): string {
  let best = NAMED[0];
  let bestD = Infinity;
  for (const c of NAMED) {
    const d =
      (c.rgb[0] - rgb[0]) ** 2 + (c.rgb[1] - rgb[1]) ** 2 + (c.rgb[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best.name;
}
