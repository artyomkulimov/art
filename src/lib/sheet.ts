/**
 * Lays paintings out on the wall's grid. Everything is measured in grid cells.
 * Paintings keep their real relative size (`perMeter` cells per metre) and
 * snap to half-cell lines, filling the sheet top to bottom and alternating
 * between left- and right-hand placement so the sheet reads as composed.
 */
import type { Painting } from "@/lib/paintings";

export interface Box {
  h: number;
  w: number;
  x: number;
  y: number;
}

interface Spec {
  cols: number;
  /** Rows reserved at the bottom for the footer. */
  foot: number;
  /** Area kept free for the title block. */
  hero: Box;
  /** Empty space kept at the left and right edges. */
  margin: number;
  perMeter: number;
}

export type Sheet = Spec & { rows: number; boxes: Box[]; footer: Box };

/** Packing resolution: half cells. */
const R = 2;
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

/** `items` are drawn sizes in metres (width from the real size, height from the image's aspect). */
export const layout = (
  items: { w: number; h: number }[],
  spec: Spec
): Sheet => {
  const width = spec.cols * R;
  const taken: boolean[][] = [];
  const isFree = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (taken[j]?.[i]) {
          return false;
        }
      }
    }
    return true;
  };
  const take = (x: number, y: number, w: number, h: number) => {
    for (let j = Math.max(0, y); j < y + h; j++) {
      taken[j] ??= [];
      for (let i = Math.max(0, x); i < x + w; i++) {
        taken[j][i] = true;
      }
    }
  };
  // Reserve a box plus a half-cell gutter around it (a full cell below, for captions).
  const reserve = (x: number, y: number, w: number, h: number) =>
    take(x - 1, y - 1, w + 2, h + 3);

  const { hero } = spec;
  reserve(hero.x * R, hero.y * R, Math.ceil(hero.w * R), Math.ceil(hero.h * R));
  const lo = Math.round(spec.margin * R);
  const hi = width - lo;
  let bottom = hero.y + hero.h;

  const boxes = items.map((item, n) => {
    let w = item.w * spec.perMeter;
    let h = item.h * spec.perMeter;
    const room = (hi - lo) / R;
    if (w > room) {
      h *= room / w;
      w = room;
    }
    const wu = Math.ceil(w * R - 1e-6);
    const hu = Math.ceil(h * R - 1e-6);
    const fromRight = n % 2 === 1;
    // Candidate columns: prefer an edge that sits on a full cell line.
    const xs: number[] = [];
    for (let x = lo; x + wu <= hi; x++) {
      xs.push(x);
    }
    const edge = (x: number) => (fromRight ? x + wu : x);
    const ordered = [
      ...xs.filter((x) => edge(x) % R === 0),
      ...xs.filter((x) => edge(x) % R !== 0),
    ];
    if (fromRight) {
      ordered.sort(
        (a, b) => Number(edge(a) % R !== 0) - Number(edge(b) % R !== 0) || b - a
      );
    }
    for (let y = Math.round(hero.y * R); ; y++) {
      const x = ordered.find((c) => isFree(c, y, wu, hu));
      if (x !== undefined) {
        reserve(x, y, wu, hu);
        bottom = Math.max(bottom, y / R + h);
        return { x: fromRight ? (x + wu) / R - w : x / R, y: y / R, w, h };
      }
    }
  });

  const rows = Math.ceil(bottom + 0.8) + spec.foot;
  return {
    ...spec,
    rows,
    boxes,
    footer: { x: 0, y: rows - spec.foot, w: spec.cols, h: spec.foot },
  };
};

/** The whole cells a box touches, for drawing its outline on the grid. */
export const plotOf = (b: Box): Box => {
  const x = Math.floor(b.x + 1e-6);
  const y = Math.floor(b.y + 1e-6);
  return {
    x,
    y,
    w: Math.ceil(b.x + b.w - 1e-6) - x,
    h: Math.ceil(b.y + b.h - 1e-6) - y,
  };
};
