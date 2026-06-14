import type { Point } from "./types";

// 8-neighbour offsets in clockwise order, starting due East.
const DIRS: Point[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/**
 * Moore-neighbour boundary tracing. Given a predicate marking pixels inside a
 * region and a top-left seed pixel of that region, walks its outer boundary
 * clockwise and returns the ordered loop of boundary pixels.
 */
export function traceBoundary(
  inside: (x: number, y: number) => boolean,
  w: number,
  h: number,
  startX: number,
  startY: number,
): Point[] {
  const contour: Point[] = [[startX, startY]];

  // We arrived at the seed from the west (it's the top-left pixel, so the
  // pixel to its left is background).
  let bx = startX;
  let by = startY;
  let prevX = startX - 1;
  let prevY = startY;

  const maxIter = w * h * 4;
  for (let safety = 0; safety < maxIter; safety++) {
    // Direction from the current boundary pixel back to where we came from.
    const dx = prevX - bx;
    const dy = prevY - by;
    let startIdx = DIRS.findIndex((d) => d[0] === dx && d[1] === dy);
    if (startIdx < 0) startIdx = 0;

    let foundX = -1;
    let foundY = -1;
    let lastBgX = prevX;
    let lastBgY = prevY;

    // Sweep clockwise from the backtrack pixel for the next inside pixel.
    for (let k = 1; k <= 8; k++) {
      const idx = (startIdx + k) % 8;
      const nx = bx + DIRS[idx][0];
      const ny = by + DIRS[idx][1];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && inside(nx, ny)) {
        foundX = nx;
        foundY = ny;
        break;
      }
      lastBgX = nx;
      lastBgY = ny;
    }

    if (foundX < 0) break; // isolated pixel
    if (foundX === startX && foundY === startY) break; // closed the loop

    prevX = lastBgX;
    prevY = lastBgY;
    bx = foundX;
    by = foundY;
    contour.push([bx, by]);

    if (contour.length > w * h) break; // safety net
  }

  return contour;
}
