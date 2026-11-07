/**
 * Hangs the paintings on walls, drawn as architectural elevations. Everything
 * is measured in grid cells. Every painting gets the same visual area (so a
 * huge canvas doesn't dwarf a small print — the dimension lines still give the
 * real size), centres sit on the hanging line and on grid axes, and each wall
 * holds `perRow` paintings before a new wall starts below.
 */
import type { Painting } from "@/lib/paintings";

export interface Box {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface Spec {
  cols: number;
  /** Tallest a painting may be drawn (cells). */
  maxH: number;
  /** Widest a painting may be drawn (cells). */
  maxW: number;
  perRow: number;
}

export interface WallRow {
  datum: number;
  floor: number;
  /** The tag line along the top of the wall (cells from the elevation's top). */
  tags: number;
  top: number;
}

export interface Hung extends Box {
  /** Centre line (cells from the left). */
  cx: number;
  wall: number;
}

export interface Elevation {
  height: number;
  hung: Hung[];
  walls: WallRow[];
}

/** Hanging height of a painting's centre, in metres (shown on the drawing). */
export const HANG = 1.45;
/** Room above each wall for its label (cells). */
const LABEL = 0.55;
/** From the label to the tag line, and from the tag line to the tallest painting (cells). */
const TAG_GAP = 0.3;
const TO_PAINTING = 0.75;
/** From the lowest painting edge down to the floor line (cells). */
const TO_FLOOR = 0.85;
/** Room below each floor line: hatching plus breathing space (cells). */
const AFTER = 0.8;

const SIZE_IN_MEDIUM = /(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)\s*cm/;

/** Real size in cm: explicit `size`, else parsed from `medium`, else 100 cm wide. */
export const sizeOf = (p: Painting) => {
  if (p.size) {
    return p.size;
  }
  const m = p.medium.match(SIZE_IN_MEDIUM);
  if (m) {
    return { h: Number(m[1]), w: Number(m[2]), approx: false };
  }
  return { h: (100 * p.image.height) / p.image.width, w: 100, approx: true };
};

/** `aspects` are width / height of each image. */
export const hang = (aspects: number[], s: Spec): Elevation => {
  // One shared area, as large as the most extreme shape allows.
  const area = Math.min(
    ...aspects.map((a) => Math.min(s.maxW ** 2 / a, s.maxH ** 2 * a))
  );
  const sizes = aspects.map((a) => ({
    w: Math.sqrt(area * a),
    h: Math.sqrt(area / a),
  }));

  const walls: WallRow[] = [];
  const hung: Hung[] = [];
  let top = 0;
  for (
    let start = 0, wall = 0;
    start < sizes.length;
    start += s.perRow, wall++
  ) {
    const row = sizes.slice(start, start + s.perRow);
    const tallest = Math.max(...row.map((p) => p.h));
    const tags = top + LABEL + TAG_GAP;
    const datum = tags + TO_PAINTING + tallest / 2;
    const floor = datum + tallest / 2 + TO_FLOOR;
    walls.push({ top, tags, datum, floor });
    for (const [k, p] of row.entries()) {
      // Evenly spaced centres, on half-axes at worst.
      const cx =
        Math.round(((s.cols * (2 * k + 1)) / (2 * row.length)) * 2) / 2;
      hung.push({
        x: cx - p.w / 2,
        y: datum - p.h / 2,
        w: p.w,
        h: p.h,
        cx,
        wall,
      });
    }
    top = floor + AFTER;
  }
  return { walls, hung, height: top };
};
