import type { Tile } from "./tiles";
import type { Work } from "./works";

type Placed = Tile & { p: number };
const { works, tiles }: { works: Work[]; tiles: Placed[] } = JSON.parse(document.getElementById("dm-data")!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const root = $("dm");
const grid = $("dm-grid");
const view = $("dm-view");
const mark = $("dm-mark");
const els = [...document.querySelectorAll<HTMLButtonElement>(".dm-tile")];
const fulls = [...document.querySelectorAll<HTMLElement>(".dm-full")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.76, 0, 0.18, 1)";
const DUR = reduced ? 1 : 1250;

/** The crop each tile actually shows after fitting to its box: centre + scale. */
type Crop = { x: number; y: number; m: number };
const crops: Crop[] = [];

const layoutTiles = () => {
  els.forEach((el, k) => {
    const t = tiles[k];
    const w = works[t.p];
    const box = el.getBoundingClientRect();
    // Never show less than the whole painting would need to fill the box.
    // Past ~1.1 screen px per master px the crop only gets softer.
    const m = Math.max(Math.min(1.1, t.m * Math.max(1, innerWidth / 1440) ** 0.5), box.width / w.w, box.height / w.h);
    const hx = box.width / (2 * w.w * m);
    const hy = box.height / (2 * w.h * m);
    const x = Math.min(1 - hx, Math.max(hx, t.x));
    const y = Math.min(1 - hy, Math.max(hy, t.y));
    crops[k] = { x, y, m };
    const img = el.querySelector("img")!;
    img.style.width = `${w.w}px`;
    img.style.height = `${w.h}px`;
    img.style.transform = `translate(${box.width / 2 - x * w.w * m}px, ${box.height / 2 - y * w.h * m}px) scale(${m})`;
  });
};
layoutTiles();
addEventListener("resize", () => {
  layoutTiles();
  if (openK >= 0) placeOpen();
});

// Tiles resolve as their painting's master arrives.
els.forEach((el) => {
  const img = el.querySelector("img")!;
  const done = () => img.decode().catch(() => {}).finally(() => el.classList.add("ready"));
  if (img.complete && img.naturalWidth) done();
  else img.addEventListener("load", done, { once: true });
});

// --- hover: kin light up, the legend names them --------------------------------
let peekTimer = 0;
const peek = (k: number) => {
  clearTimeout(peekTimer);
  const t = tiles[k];
  const w = works[t.p];
  els.forEach((el, j) => el.classList.toggle("kin", tiles[j].p === t.p));
  grid.classList.add("peek");
  root.classList.add("peeking");
  $("dm-h-artist").textContent = `${w.artist}, ${w.year}`;
  $("dm-h-title").textContent = w.title;
  $("dm-h-note").textContent = t.note ?? `${tiles.filter((x) => x.p === t.p).length} fragments`;
};
const unpeek = () => {
  clearTimeout(peekTimer);
  peekTimer = window.setTimeout(() => {
    grid.classList.remove("peek");
    root.classList.remove("peeking");
  }, 120);
};
els.forEach((el, k) => {
  el.addEventListener("pointerenter", () => openK < 0 && peek(k));
  el.addEventListener("pointerleave", unpeek);
  el.addEventListener("focus", () => openK < 0 && peek(k));
  el.addEventListener("blur", unpeek);
  el.addEventListener("click", () => open(k));
});

// --- the FLIP: a fragment becomes its painting --------------------------------
let openK = -1;
let busy = false;

/** Where the whole painting rests: contained, with room for the label below. */
const restRect = (p: number) => {
  const w = works[p];
  const small = innerWidth < 760;
  const top = small ? 20 : 40;
  const side = small ? 12 : 40;
  const bottom = small ? 150 : 120;
  const s = Math.min((innerWidth - side * 2) / w.w, (innerHeight - top - bottom) / w.h);
  const width = w.w * s;
  const height = w.h * s;
  return { x: (innerWidth - width) / 2, y: top + (innerHeight - top - bottom - height) / 2, s, width, height };
};

/** Transform + clip that make the full painting look exactly like tile k. */
const tileState = (k: number) => {
  const t = tiles[k];
  const w = works[t.p];
  const c = crops[k];
  const box = els[k].getBoundingClientRect();
  const tx = box.left + box.width / 2 - c.x * w.w * c.m;
  const ty = box.top + box.height / 2 - c.y * w.h * c.m;
  // The tile's box, in the painting's own pixels.
  const l = (box.left - tx) / c.m;
  const tp = (box.top - ty) / c.m;
  const r = w.w - (box.right - tx) / c.m;
  const b = w.h - (box.bottom - ty) / c.m;
  return {
    transform: `translate(${tx}px, ${ty}px) scale(${c.m})`,
    clipPath: `inset(${tp}px ${r}px ${b}px ${l}px)`,
    rect: { l, t: tp, w: box.width / c.m, h: box.height / c.m },
  };
};
const restState = (p: number) => {
  const R = restRect(p);
  return { transform: `translate(${R.x}px, ${R.y}px) scale(${R.s})`, clipPath: "inset(0px 0px 0px 0px)" };
};

const placeOpen = () => {
  const p = tiles[openK].p;
  const s = restState(p);
  fulls[p].style.transform = s.transform;
  fulls[p].style.clipPath = s.clipPath;
};

/** Other tiles leave in a ripple that spreads from the one you touched. */
const ripple = (k: number, out: boolean) => {
  const a = els[k].getBoundingClientRect();
  els.forEach((el, j) => {
    if (j === k) return;
    const b = el.getBoundingClientRect();
    const d = Math.hypot(b.left + b.width / 2 - (a.left + a.width / 2), b.top + b.height / 2 - (a.top + a.height / 2));
    const delay = reduced ? 0 : out ? d * 0.22 : 380 + (1400 - d) * 0.18;
    el.getAnimations().forEach((x) => x.cancel());
    const anim = el.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], {
      duration: reduced ? 1 : out ? 520 : 700,
      delay: Math.max(0, delay),
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
      fill: "both",
    });
    // Once back, hand opacity back to CSS (so hover dimming works again).
    if (!out) anim.finished.then(() => anim.cancel()).catch(() => {});
  });
  const legend = $("dm-legend");
  legend.getAnimations().forEach((x) => x.cancel());
  legend.animate(out ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], {
    duration: reduced ? 1 : 500,
    delay: out ? 0 : 600,
    fill: "both",
  });
};

const fillInfo = (p: number) => {
  const w = works[p];
  $("dm-title").textContent = w.title;
  $("dm-artist").textContent = w.artist;
  $("dm-year").textContent = w.year;
  $("dm-medium").textContent = w.medium;
  $("dm-location").textContent = w.location;
  $("dm-rights").textContent = w.rights;
  $("dm-source").textContent = w.source;
  $<HTMLAnchorElement>("dm-original").href = w.original;
};

const open = async (k: number) => {
  if (busy || openK >= 0) return;
  busy = true;
  openK = k;
  const p = tiles[k].p;
  const el = fulls[p];
  fillInfo(p);
  grid.classList.remove("peek");
  root.classList.remove("peeking");

  const from = tileState(k);
  const to = restState(p);
  root.classList.add("open");
  view.setAttribute("aria-hidden", "false");
  el.classList.add("on");
  el.style.transform = to.transform;
  el.style.clipPath = to.clipPath;
  els[k].style.visibility = "hidden";
  ripple(k, true);

  const anim = el.animate([from, to], { duration: DUR, easing: EASE });
  await anim.finished.catch(() => {});
  root.classList.add("settled");
  showMark(k);
  busy = false;
  $("dm-back").focus({ preventScroll: true });
};

/** A hairline lingers where the fragment was, then dissolves. */
const showMark = (k: number) => {
  if (reduced) return;
  const p = tiles[k].p;
  const R = restRect(p);
  const r = tileState(k).rect;
  mark.style.transform = `translate(${R.x + r.l * R.s}px, ${R.y + r.t * R.s}px)`;
  mark.style.width = `${r.w * R.s}px`;
  mark.style.height = `${r.h * R.s}px`;
  mark.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.15 }, { opacity: 0.9, offset: 0.55 }, { opacity: 0 }], {
    duration: 2600,
    easing: "ease-in-out",
  });
};

const close = async () => {
  if (busy || openK < 0) return;
  busy = true;
  const k = openK;
  const p = tiles[k].p;
  const el = fulls[p];
  root.classList.remove("settled");
  mark.getAnimations().forEach((a) => a.cancel());
  const from = restState(p);
  const to = tileState(k);
  ripple(k, false);
  const anim = el.animate([from, { transform: to.transform, clipPath: to.clipPath }], {
    duration: reduced ? 1 : 1100,
    easing: EASE,
    delay: reduced ? 0 : 120,
  });
  await anim.finished.catch(() => {});
  els[k].style.visibility = "";
  el.classList.remove("on");
  root.classList.remove("open");
  view.setAttribute("aria-hidden", "true");
  openK = -1;
  busy = false;
  els[k].focus({ preventScroll: true });
};

view.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a")) return;
  close();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openK >= 0) close();
});
