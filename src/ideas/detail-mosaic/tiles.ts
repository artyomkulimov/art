/**
 * The mosaic: a 12 × 7 field of fragments. Each letter in `MAP` is one tile;
 * `#` is the legend. Each tile is a crop of one painting, centred on (x, y)
 * (0–1 across the image) at `m` screen px per master px (1 ≈ native).
 * Crops were chosen for brushwork: high local contrast, not lost in shadow.
 * `note` marks the details from paintings.yaml.
 */
export type Tile = { id: string; c: number; r: number; w: number; h: number; x: number; y: number; m: number; note?: string };

export const COLS = 12;
export const ROWS = 7;
export const LEGEND = { c: 3, r: 1, w: 2, h: 2 };

const MAP = `
AA##BCCCDEFF
AA##GCCCDHFF
IJJKGCCCMHNN
IJJKOOPQMRRS
TTUKOOPQVRRS
TTUWWXXYVZZa
bccWWXXYdZZe
`;

const P = "pandemonium";
const B = "fall-of-babylon";
const W = "wet-moon-putney-road";

type Crop = Omit<Tile, "c" | "r" | "w" | "h">;
const crops: Record<string, Crop> = {
  A: { id: P, x: 0.38, y: 0.82, m: 0.8, note: "The burning lake" },
  B: { id: W, x: 0.225, y: 0.088, m: 1 },
  C: { id: B, x: 0.68, y: 0.24, m: 0.62, note: "Lightning over the Euphrates" },
  D: { id: P, x: 0.865, y: 0.14, m: 0.95 },
  E: { id: B, x: 0.651, y: 0.075, m: 1 },
  F: { id: W, x: 0.18, y: 0.24, m: 0.8, note: "The moon through bare branches" },
  G: { id: P, x: 0.521, y: 0.49, m: 1 },
  H: { id: W, x: 0.525, y: 0.175, m: 0.95 },
  I: { id: B, x: 0.193, y: 0.791, m: 0.95 },
  J: { id: P, x: 0.722, y: 0.555, m: 0.72, note: "Satan, shield raised, on the rock" },
  K: { id: W, x: 0.225, y: 0.439, m: 0.95 },
  M: { id: B, x: 0.747, y: 0.414, m: 1 },
  N: { id: P, x: 0.478, y: 0.665, m: 0.95 },
  O: { id: B, x: 0.33, y: 0.3, m: 0.8, note: "The Tower of Babel above the city" },
  P: { id: W, x: 0.34, y: 0.74, m: 1, note: "A lone carriage on the wet road" },
  Q: { id: P, x: 0.695, y: 0.527, m: 1 },
  R: { id: W, x: 0.74, y: 0.58, m: 0.85, note: "Gaslit windows behind the wall" },
  S: { id: B, x: 0.916, y: 0.151, m: 1 },
  T: { id: B, x: 0.28, y: 0.76, m: 0.85, note: "The women of the court" },
  U: { id: P, x: 0.347, y: 0.866, m: 1 },
  V: { id: W, x: 0.9, y: 0.702, m: 1 },
  W: { id: P, x: 0.45, y: 0.42, m: 0.8, note: "The palace of Pandemonium, lit from within" },
  X: { id: B, x: 0.506, y: 0.678, m: 0.9 },
  Y: { id: W, x: 0.3, y: 0.921, m: 1 },
  Z: { id: P, x: 0.571, y: 0.829, m: 0.9 },
  a: { id: B, x: 0.795, y: 0.188, m: 1.05 },
  b: { id: W, x: 0.775, y: 0.833, m: 1.05 },
  c: { id: B, x: 0.337, y: 0.866, m: 0.95 },
  d: { id: P, x: 0.8, y: 0.615, m: 1.05 },
  e: { id: W, x: 0.625, y: 0.088, m: 1.05 },
};

/** Read each letter's bounding box off the map (in reading order). */
const parse = () => {
  const rows = MAP.trim().split("\n");
  const boxes = new Map<string, { c0: number; r0: number; c1: number; r1: number }>();
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === "#") return;
      const b = boxes.get(ch);
      if (!b) boxes.set(ch, { c0: c, r0: r, c1: c, r1: r });
      else {
        b.c1 = Math.max(b.c1, c);
        b.r1 = Math.max(b.r1, r);
      }
    }),
  );
  return [...boxes].map(([ch, b]) => ({
    ...crops[ch],
    c: b.c0 + 1,
    r: b.r0 + 1,
    w: b.c1 - b.c0 + 1,
    h: b.r1 - b.r0 + 1,
  }));
};

export const tiles: Tile[] = parse();
