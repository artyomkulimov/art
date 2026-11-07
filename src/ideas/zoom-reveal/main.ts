import { bezier, clamp, easeOutSine } from "./motion";
import type { Work } from "./works";

const works: Work[] = JSON.parse(document.getElementById("zr-data")!.textContent!);
const layers = [...document.querySelectorAll<HTMLElement>(".zr .layer")];
const $ = (id: string) => document.getElementById(id)!;
const noteEl = $("zr-note");
const labelEl = $("zr-label");
const metaEl = $("zr-meta");
const hintEl = $("zr-hint");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Never magnify the master beyond this many screen px per source px. */
const MAX_PX = 1.18;
const HOLD = 2900;
const PULL = 4600;
const pullEase = bezier(0.62, 0, 0.12, 1);
const fadeEase = bezier(0.3, 0, 0.2, 1);

type Cam = { x: number; y: number; z: number };

let vw = innerWidth;
let vh = innerHeight;
const fit = (w: Work) => Math.min(vw / w.w, vh / w.h);

/** Place a layer so image point (x, y) sits at the viewport centre at zoom z (1 = contain). */
const place = (i: number, cam: Cam) => {
  const w = works[i];
  const s = fit(w) * cam.z;
  const tx = vw / 2 - cam.x * w.w * s;
  const ty = vh / 2 - cam.y * w.h * s;
  layers[i].style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
};

/** Keep the view inside the painting where the painting is bigger than the screen. */
const clampCam = (w: Work, cam: Cam): Cam => {
  const s = fit(w) * cam.z;
  const hw = vw / (2 * w.w * s);
  const hh = vh / (2 * w.h * s);
  return {
    z: cam.z,
    x: hw < 0.5 ? clamp(cam.x, hw, 1 - hw) : 0.5,
    y: hh < 0.5 ? clamp(cam.y, hh, 1 - hh) : 0.5,
  };
};

const detailZoom = (w: Work, zoom: number) => Math.min(zoom, MAX_PX / fit(w));

// --- loading -----------------------------------------------------------------
const loaded: Promise<void>[] = layers.map((layer) => {
  const img = layer.querySelector<HTMLImageElement>(".full")!;
  return new Promise<void>((resolve) => {
    const done = () => {
      img.decode().catch(() => {}).finally(() => {
        img.classList.add("ready");
        resolve();
      });
    };
    if (img.complete && img.naturalWidth) done();
    else img.addEventListener("load", done, { once: true });
  });
});
const startLoading = (i: number) => {
  const img = layers[i]?.querySelector<HTMLImageElement>(".full");
  if (img && !img.getAttribute("src")) img.src = img.dataset.src!;
};
// Fetch the rest one after another once the first is in.
loaded[0].then(async () => {
  for (let i = 1; i < layers.length; i++) {
    startLoading(i);
    await loaded[i];
  }
});

// --- captions ----------------------------------------------------------------
const setNote = (text: string, zoom: number) => {
  noteEl.className = "note";
  const words = text.split(" ").map((t, k) => `<span class="w" style="transition-delay:${120 + k * 55}ms">${t}</span>`);
  noteEl.innerHTML = `<span class="w x" style="transition-delay:0ms">Detail ×${zoom.toFixed(zoom % 1 ? 1 : 0)}</span>${words.join(" ")}`;
  void noteEl.offsetWidth;
  noteEl.classList.add("in");
};
const hideNote = () => noteEl.classList.add("out");

const setLabel = (w: Work) => {
  $("zr-title").textContent = w.title;
  $("zr-artist").textContent = w.artist;
  $("zr-year").textContent = w.year;
  $("zr-medium").textContent = w.medium;
  $("zr-location").textContent = w.location;
  $("zr-rights").textContent = w.rights;
  $("zr-source").textContent = w.source;
  ($("zr-original") as HTMLAnchorElement).href = w.original;
};
const showLabel = () => {
  labelEl.classList.remove("out");
  labelEl.classList.add("in");
  metaEl.classList.add("in");
};
const hideLabel = () => {
  labelEl.classList.remove("in");
  labelEl.classList.add("out");
  metaEl.classList.remove("in");
};

// --- the sequence ------------------------------------------------------------
let current = 0;
let token = 0;
let raf = 0;
let settled = false;
let visits = works.map(() => 0);
let state: { i: number; start: number; detail: number } | null = null;

/** Camera and opacity for painting i, `t` ms into its reveal. */
const frameAt = (i: number, detail: number, t: number) => {
  const w = works[i];
  const d = w.details[detail];
  if (!d || reduced) return { cam: { x: 0.5, y: 0.5, z: 1 }, opacity: clamp(t / 600, 0, 1) };

  const z0 = detailZoom(w, d.zoom);
  const z1 = z0 * 1.045;
  const opacity = fadeEase(clamp(t / 1300, 0, 1));
  if (t < HOLD) {
    // A slow breath inward while the detail is held.
    const z = z0 + (z1 - z0) * easeOutSine(t / HOLD);
    return { cam: clampCam(w, { x: d.x, y: d.y, z }), opacity };
  }
  const e = pullEase(clamp((t - HOLD) / PULL, 0, 1));
  const z = z1 ** (1 - e); // log-space: equal ratios per unit time
  const start = clampCam(w, { x: d.x, y: d.y, z: z1 });
  const f = fit(w);
  // Screen position of the detail point: from where the held view showed it to where it truly lives.
  const sx0 = vw / 2 + (d.x - start.x) * w.w * f * z1;
  const sy0 = vh / 2 + (d.y - start.y) * w.h * f * z1;
  const sx1 = vw / 2 + (d.x - 0.5) * w.w * f;
  const sy1 = vh / 2 + (d.y - 0.5) * w.h * f;
  const sx = sx0 + (sx1 - sx0) * e;
  const sy = sy0 + (sy1 - sy0) * e;
  const s = f * z;
  const cam = clampCam(w, { x: d.x - (sx - vw / 2) / (w.w * s), y: d.y - (sy - vh / 2) / (w.h * s), z });
  return { cam, opacity };
};

const duration = () => (reduced ? 600 : HOLD + PULL);

const tick = (now: number) => {
  if (!state) return;
  const t = now - state.start;
  const { cam, opacity } = frameAt(state.i, state.detail, t);
  place(state.i, cam);
  layers[state.i].style.opacity = String(opacity);
  if (t < duration()) raf = requestAnimationFrame(tick);
};

const play = async (i: number, fresh = true) => {
  const my = ++token;
  cancelAnimationFrame(raf);
  settled = false;
  const w = works[i];
  const detail = w.details.length ? visits[i] % w.details.length : -1;
  visits[i]++;
  current = i;

  $("zr-num").textContent = roman[i];
  layers.forEach((l, k) => l.setAttribute("aria-hidden", String(k !== i)));

  // Outgoing painting recedes into the dark.
  const out = layers.filter((l, k) => k !== i && Number(l.style.opacity || 0) > 0);
  if (out.length || !fresh) {
    hideLabel();
    noteEl.classList.add("out");
    for (const l of out) {
      l.style.transition = "opacity 0.85s cubic-bezier(.4,0,.2,1)";
      l.style.opacity = "0";
    }
    if (!fresh) {
      const l = layers[i];
      l.style.transition = "opacity 0.7s cubic-bezier(.4,0,.2,1)";
      l.style.opacity = "0";
    }
    await new Promise((r) => setTimeout(r, out.length || !fresh ? 750 : 0));
    if (my !== token) return;
    for (const l of [...out, layers[i]]) l.style.transition = "";
  }

  startLoading(i);
  await loaded[i];
  if (my !== token) return;

  setLabel(w);
  // Reset the title below its mask without animating back through view.
  labelEl.classList.add("reset");
  labelEl.classList.remove("in", "out");
  void labelEl.offsetWidth;
  labelEl.classList.remove("reset");
  const d = w.details[detail];
  state = { i, detail, start: performance.now() };
  raf = requestAnimationFrame(tick);

  if (d && !reduced) {
    setTimeout(() => my === token && setNote(d.note, detailZoom(w, d.zoom) * 1.045), 650);
    setTimeout(() => my === token && hideNote(), HOLD - 150);
  }
  setTimeout(
    () => {
      if (my !== token) return;
      settled = true;
      showLabel();
      if (navCount === 0) hintEl.classList.add("in");
    },
    reduced ? 300 : HOLD + PULL - 900,
  );
};

// --- navigation --------------------------------------------------------------
let navCount = 0;
let lastNav = 0;
const go = (dir: number) => {
  const now = performance.now();
  if (now - lastNav < 1100) return;
  lastNav = now;
  navCount++;
  hintEl.classList.remove("in");
  play((current + dir + works.length) % works.length);
};

// One gesture = one painting. After a move, the wheel stays locked until it
// has been quiet for a moment (trackpad inertia can run for a second or more).
let wheelAcc = 0;
let wheelLocked = false;
let wheelQuiet = 0;
addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    clearTimeout(wheelQuiet);
    wheelQuiet = window.setTimeout(() => {
      wheelAcc = 0;
      wheelLocked = false;
    }, 320);
    if (wheelLocked) return;
    wheelAcc += e.deltaY + e.deltaX;
    if (Math.abs(wheelAcc) > 60) {
      go(Math.sign(wheelAcc));
      wheelLocked = true;
    }
  },
  { passive: false },
);

addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
    e.preventDefault();
    go(1);
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
    e.preventDefault();
    go(-1);
  } else if (e.key === "Enter" || e.key.toLowerCase() === "r") {
    if (settled) play(current, false);
  }
});

// Touch: a vertical swipe moves between paintings.
let touchY = 0;
addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true });
addEventListener("touchend", (e) => {
  const dy = touchY - e.changedTouches[0].clientY;
  if (Math.abs(dy) > 50) go(Math.sign(dy));
});

// Clicking the settled painting dives back in, to its next detail.
document.querySelector(".zr .stage")!.addEventListener("click", () => {
  if (settled) play(current, false);
});

addEventListener("resize", () => {
  vw = innerWidth;
  vh = innerHeight;
  if (state) {
    const { cam, opacity } = frameAt(state.i, state.detail, performance.now() - state.start);
    place(state.i, cam);
    layers[state.i].style.opacity = String(opacity);
  }
});

play(0);
