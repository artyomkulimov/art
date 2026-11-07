/**
 * Hangs the paintings on walls, drawn as architectural elevations. Everything
 * is measured in grid cells. Paintings keep their real relative size
 * (`perMeter` cells per metre), are hung with their centres on the museum line
 * (145 cm above the floor) and centred on grid axes. A wall fills left to
 * right; when the next painting doesn't fit, a new wall starts below.
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
  /** Space between neighbouring paintings (cells). */
  gap: number;
  /** Space kept free at the sheet's left and right edges (cells). */
  margin: number;
  perMeter: number;
  /** Painting centres snap to multiples of this (cells). */
  step: number;
}

export interface WallRow {
  datum: number;
  floor: number;
  /** Height of the tag line (cells, from the elevation's top). */
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

/** Hanging height of a painting's centre, in metres. */
export const HANG = 1.45;
const HEADROOM = 0.32;
/** Room above each wall for its label (cells). */
const LABEL = 0.6;
/** Room below each floor line: hatching plus breathing space (cells). */
const AFTER = 0.9;

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

interface Item {
  cx: number;
  h: number;
  i: number;
  w: number;
}

/** Splits paintings into walls and picks each one's centre axis. */
const rowsOf = (items: { w: number; h: number }[], s: Spec) => {
  const rows: Item[][] = [];
  let row: Item[] = [];
  let right = s.margin - s.gap;
  const centreAfter = (w: number) =>
    Math.ceil((right + s.gap + w / 2) / s.step - 1e-6) * s.step;
  for (const [i, it] of items.entries()) {
    const room = s.cols - 2 * s.margin;
    const k = Math.min(1, room / (it.w * s.perMeter));
    const w = it.w * s.perMeter * k;
    const h = it.h * s.perMeter * k;
    let cx = centreAfter(w);
    if (row.length > 0 && cx + w / 2 > s.cols - s.margin + 1e-6) {
      rows.push(row);
      row = [];
      right = s.margin - s.gap;
      cx = centreAfter(w);
    }
    row.push({ i, cx, w, h });
    right = cx + w / 2;
  }
  if (row.length > 0) {
    rows.push(row);
  }
  // Centre each wall on the sheet, keeping centres on whole steps.
  for (const r of rows) {
    const first = r[0];
    const last = r.at(-1) ?? first;
    const leftSpace = first.cx - first.w / 2;
    const rightSpace = s.cols - (last.cx + last.w / 2);
    const shift = Math.trunc((rightSpace - leftSpace) / 2 / s.step) * s.step;
    for (const p of r) {
      p.cx += shift;
    }
  }
  return rows;
};

/** `items` are drawn sizes in metres (real width; height from the image's aspect). */
export const hang = (items: { w: number; h: number }[], s: Spec): Elevation => {
  const walls: WallRow[] = [];
  const hung: Hung[] = [];
  let top = 0;
  for (const [wall, r] of rowsOf(items, s).entries()) {
    // Height of each centre above the floor; very tall works go higher.
    const centre = (p: Item) =>
      Math.max(HANG * s.perMeter, p.h / 2 + 0.3 * s.perMeter);
    const height =
      Math.max(...r.map((p) => centre(p) + p.h / 2)) + HEADROOM * s.perMeter;
    const floor = top + LABEL + height;
    const lowest = Math.min(...r.map((p) => centre(p) - p.h / 2));
    walls.push({
      top,
      floor,
      datum: floor - HANG * s.perMeter,
      tags: floor - Math.max(0.35, lowest - 0.5),
    });
    for (const p of r) {
      hung.push({
        x: p.cx - p.w / 2,
        y: floor - centre(p) - p.h / 2,
        w: p.w,
        h: p.h,
        cx: p.cx,
        wall,
      });
    }
    top = floor + AFTER;
  }
  // `hung` is in painting order because rows are filled in order.
  return { walls, hung, height: top };
};
