import { bezier, clamp, flyTo } from "./motion";
import type { Work } from "./works";

const works: Work[] = JSON.parse(document.getElementById("sp-data")!.textContent!);
const $ = (id: string) => document.getElementById(id)!;
const layers = [...document.querySelectorAll<HTMLElement>(".sp-layer")];
const caps = [...document.querySelectorAll<HTMLElement>(".sp-cap")];
const infos = [...document.querySelectorAll<HTMLElement>(".sp-info")];
const rail = $("sp-rail");
const dot = $("sp-dot");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// Scroll lengths, in viewport heights.
const HOLD = 0.42;
const MOVE = 0.85;
const PULL = 1.15;
const FULL = 0.75;
const FADE = 0.95;
/** Never magnify the master beyond this many screen px per source px. */
const MAX_PX = 1.2;
const moveEase = bezier(0.65, 0, 0.35, 1);
const outEase = bezier(0.4, 0, 0.7, 0.2);
const inEase = bezier(0.2, 0.7, 0.3, 1);

type Cam = { x: number; y: number; z: number };
type Seg = { kind: "hold" | "move" | "fade"; i: number; a: number; b: number; len: number; start: number };

let vw = innerWidth;
let vh = innerHeight;
const fit = (w: Work) => Math.min(vw / w.w, vh / w.h);

const clampCam = (w: Work, c: Cam): Cam => {
  const s = fit(w) * c.z;
  const hw = vw / (2 * w.w * s);
  const hh = vh / (2 * w.h * s);
  return { z: c.z, x: hw < 0.5 ? clamp(c.x, hw, 1 - hw) : 0.5, y: hh < 0.5 ? clamp(c.y, hh, 1 - hh) : 0.5 };
};

/** Stop k of painting i: its details in order, then the whole painting. */
const stop = (i: number, k: number): Cam => {
  const w = works[i];
  const d = w.details[k];
  if (!d) return { x: 0.5, y: 0.5, z: 1 };
  return clampCam(w, { x: d.x, y: d.y, z: Math.min(d.zoom, MAX_PX / fit(w)) });
};

// --- the timeline --------------------------------------------------------------
const segs: Seg[] = [];
let total = 0;
const push = (s: Omit<Seg, "start">) => {
  segs.push({ ...s, start: total });
  total += s.len;
};
works.forEach((w, i) => {
  const n = w.details.length;
  for (let k = 0; k < n; k++) {
    push({ kind: "hold", i, a: k, b: k, len: HOLD });
    push({ kind: "move", i, a: k, b: k + 1, len: k + 1 === n ? PULL : MOVE });
  }
  push({ kind: "hold", i, a: n, b: n, len: i === works.length - 1 ? FULL + 0.4 : FULL });
  if (i < works.length - 1) push({ kind: "fade", i, a: n, b: 0, len: FADE });
});
const holds = segs.filter((s) => s.kind === "hold");
const stopAt = (s: Seg) => s.start + s.len / 2;

// Camera paths for each move, rebuilt on resize.
let paths = new Map<Seg, (t: number) => Cam>();
const buildPaths = () => {
  paths = new Map();
  for (const s of segs) {
    if (s.kind !== "move") continue;
    const w = works[s.i];
    const f = fit(w);
    const view = (c: Cam): [number, number, number] => [c.x * w.w * f, c.y * w.h * f, vw / c.z];
    const fly = flyTo(view(stop(s.i, s.a)), view(stop(s.i, s.b)));
    paths.set(s, (t) => {
      const [x, y, width] = fly(t);
      return clampCam(w, { x: x / (w.w * f), y: y / (w.h * f), z: vw / width });
    });
  }
};

const place = (i: number, c: Cam, opacity: number) => {
  const w = works[i];
  const s = fit(w) * c.z;
  layers[i].style.transform = `translate3d(${vw / 2 - c.x * w.w * s}px, ${vh / 2 - c.y * w.h * s}px, 0) scale(${s})`;
  layers[i].style.opacity = String(opacity);
};

const segAt = (p: number) => segs.find((s) => p < s.start + s.len) ?? segs[segs.length - 1];

let intro = reduced ? 1 : 0;
const render = (p: number) => {
  const s = segAt(p);
  const t = clamp((p - s.start) / s.len, 0, 1);
  const shown = new Set<number>();
  if (s.kind === "hold") {
    place(s.i, stop(s.i, s.a), intro);
    shown.add(s.i);
  } else if (s.kind === "move") {
    const c = reduced ? stop(s.i, t < 0.5 ? s.a : s.b) : paths.get(s)!(moveEase(t));
    place(s.i, c, intro);
    shown.add(s.i);
  } else {
    // The whole painting recedes into the dark as the next one's first detail arrives.
    const full = stop(s.i, s.a);
    const next = stop(s.i + 1, 0);
    if (reduced) {
      place(t < 0.5 ? s.i : s.i + 1, t < 0.5 ? full : next, 1);
      shown.add(t < 0.5 ? s.i : s.i + 1);
    } else {
      place(s.i, { ...full, z: full.z * (1 - 0.07 * outEase(t)) }, 1 - clamp(t / 0.62, 0, 1) ** 1.4);
      place(s.i + 1, { ...next, z: next.z * (0.93 + 0.07 * inEase(t)) }, inEase(clamp((t - 0.32) / 0.68, 0, 1)));
      shown.add(s.i).add(s.i + 1);
    }
  }
  layers.forEach((l, k) => {
    if (!shown.has(k)) l.style.opacity = "0";
  });

  // Words: a detail's caption around its stop; the painting's name once it is whole.
  caps.forEach((cap) => {
    const i = Number(cap.dataset.i);
    const k = Number(cap.dataset.k);
    const h = holds.find((x) => x.i === i && x.a === k)!;
    cap.classList.toggle("on", p > h.start - MOVE * 0.3 && p < h.start + h.len + MOVE * 0.32);
  });
  infos.forEach((info, i) => {
    const h = holds.find((x) => x.i === i && x.a === works[i].details.length)!;
    info.classList.toggle("on", p > h.start - PULL * 0.22 && p < h.start + h.len + FADE * 0.22);
  });

  const chapter = s.kind === "fade" && t > 0.5 ? s.i + 1 : s.i;
  $("sp-chapter").innerHTML = `${ROMAN[chapter]} <i>/</i> ${ROMAN[works.length - 1]}`;
  dot.style.transform = `translateY(${(p / total) * rail.clientHeight}px)`;
  ticks.forEach((tk, k) => tk.classList.toggle("past", stopAt(holds[k]) <= p + 0.02));
  $("sp-hint").classList.toggle("gone", p > 0.12);
};

// --- rail ----------------------------------------------------------------------
const ticks = holds.map((h) => {
  const b = document.createElement("button");
  b.className = "sp-rail-tick";
  if (h.a === works[h.i].details.length) b.classList.add("full");
  b.style.top = `${(stopAt(h) / total) * 100}%`;
  const d = works[h.i].details[h.a];
  b.setAttribute("aria-label", `${works[h.i].title}${d ? ` — ${d.note}` : ""}`);
  b.addEventListener("click", () => goTo(stopAt(h)));
  rail.appendChild(b);
  return b;
});

// --- scroll → camera, with a little inertia -------------------------------------
const track = $("sp-track");
const sizeTrack = () => {
  vw = innerWidth;
  vh = innerHeight;
  track.style.height = `${(total + 1) * vh}px`;
  buildPaths();
};
sizeTrack();

const target = () => clamp(scrollY / vh, 0, total);
let shownP = target();
let raf = 0;
let last = performance.now();
const tick = (now: number) => {
  const dt = Math.min(64, now - last);
  last = now;
  const goal = target();
  shownP = reduced ? goal : shownP + (goal - shownP) * (1 - Math.exp(-dt / 170));
  if (Math.abs(goal - shownP) < 0.0004) shownP = goal;
  if (!reduced && intro < 1) intro = Math.min(1, intro + dt / 1400);
  render(shownP);
  raf = shownP !== goal || intro < 1 ? requestAnimationFrame(tick) : 0;
};
const wake = () => {
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
};
addEventListener("scroll", wake, { passive: true });
addEventListener("resize", () => {
  sizeTrack();
  render(shownP);
});

const goTo = (p: number) => scrollTo({ top: p * vh, behavior: reduced ? "auto" : "smooth" });
addEventListener("keydown", (e) => {
  const p = target();
  if (["ArrowDown", "PageDown", " "].includes(e.key)) {
    e.preventDefault();
    const h = holds.find((x) => stopAt(x) > p + 0.02);
    if (h) goTo(stopAt(h));
  } else if (["ArrowUp", "PageUp"].includes(e.key)) {
    e.preventDefault();
    const h = [...holds].reverse().find((x) => stopAt(x) < p - 0.02);
    goTo(h ? stopAt(h) : 0);
  }
});

// --- images: the first master first, the rest in order ---------------------------
const ready = layers.map((l) => {
  const img = l.querySelector<HTMLImageElement>(".sp-full")!;
  return () =>
    new Promise<void>((resolve) => {
      if (!img.getAttribute("src")) img.src = img.dataset.src!;
      const done = () => {
        img.decode().catch(() => {}).finally(() => {
          img.classList.add("ready");
          resolve();
        });
      };
      if (img.complete && img.naturalWidth) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      }
    });
});
(async () => {
  await ready[0]();
  wake();
  for (let i = 1; i < ready.length; i++) await ready[i]();
})();

render(shownP);
