import type { Work } from "./works";

const works: Work[] = JSON.parse(document.getElementById("lp-data")!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const root = document.querySelector<HTMLElement>(".lp")!;
const stage = $("lp-stage");
const frames = [...document.querySelectorAll<HTMLElement>(".lp-frame")];
const shown = frames.map((f) => f.querySelector("img")!);
const canvas = $<HTMLCanvasElement>("lp-lens");
const ctx = canvas.getContext("2d")!;
const noteEl = $("lp-note");
const powerEl = $("lp-power");
const navButtons = [...document.querySelectorAll<HTMLButtonElement>(".lp-nav button")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
const TAU = Math.PI * 2;

// Reveal each painting (and its points of interest) once its pixels are here.
shown.forEach((img, i) => {
  const done = () => frames[i].classList.add("loaded");
  if (img.complete && img.naturalWidth) done();
  else img.addEventListener("load", done, { once: true });
});

// --- full-resolution masters, fetched in the background ----------------------
const masters: (HTMLImageElement | null)[] = works.map(() => null);
const loadMaster = (i: number) =>
  new Promise<void>((resolve) => {
    if (masters[i]) return resolve();
    const img = new Image();
    img.decoding = "async";
    img.src = works[i].full;
    img
      .decode()
      .then(() => (masters[i] = img))
      .catch(() => {})
      .finally(resolve);
  });
(async () => {
  await loadMaster(0);
  for (let i = 1; i < works.length; i++) await loadMaster(i);
})();

// --- state --------------------------------------------------------------------
let active = 0;
let R = 150;
let PAD = 14;
let dpr = 1;
const pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false, touch: false };
const lens = { x: innerWidth / 2, y: innerHeight / 2, r: 0, m: 3 };
let userPower = 3;
let powerOverride = false; // the wheel beats a detail's preset zoom
let hot = -1; // index of the detail the lens is resting on
let swapUntil = 0;
let powerShownUntil = 0;

const size = () => {
  R = Math.round(Math.min(Math.max(Math.min(innerWidth, innerHeight) * 0.165, 96), 170));
  PAD = 14;
  dpr = Math.min(devicePixelRatio || 1, 2);
  const css = (R + PAD) * 2;
  canvas.width = css * dpr;
  canvas.height = css * dpr;
  canvas.style.width = `${css}px`;
  canvas.style.height = `${css}px`;
};
size();
addEventListener("resize", size);

/** Screen-space position of a detail of the active painting. */
const poiScreen = (k: number) => {
  const d = works[active].details[k];
  const fr = frames[active].getBoundingClientRect();
  return { x: fr.left + d.x * fr.width, y: fr.top + d.y * fr.height };
};

/** The most magnification worth showing: past ~1.3 screen px per source px it only gets softer. */
const maxPower = () => {
  const fr = frames[active].getBoundingClientRect();
  return Math.max(1.5, 1.3 / (fr.width / works[active].w));
};

// --- drawing ------------------------------------------------------------------
const draw = () => {
  const c = R + PAD;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c * 2, c * 2);
  const r = lens.r;
  if (r < 0.5) return;

  const fr = frames[active].getBoundingClientRect();
  const src: HTMLImageElement = masters[active] ?? shown[active];
  const sw = src.naturalWidth || works[active].w;
  const disp = fr.width / sw; // screen px per source px at rest
  const k = disp * lens.m; // inside the lens
  const sx = (lens.x - fr.left) / disp;
  const sy = (lens.y - fr.top) / disp;
  const half = r / k;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = "#0b0a09";
  ctx.fillRect(c - r, c - r, r * 2, r * 2);
  ctx.imageSmoothingQuality = "high";
  // The glass gathers a little light.
  ctx.filter = "brightness(1.12) contrast(1.04)";
  ctx.drawImage(src, sx - half, sy - half, half * 2, half * 2, c - r, c - r, r * 2, r * 2);
  ctx.filter = "none";

  // A breath of depth toward the rim, like looking through thick glass.
  const v = ctx.createRadialGradient(c, c, r * 0.62, c, c, r);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = v;
  ctx.fillRect(c - r, c - r, r * 2, r * 2);

  // Feather the edge into the painting beneath.
  ctx.globalCompositeOperation = "destination-in";
  const f = ctx.createRadialGradient(c, c, r * 0.93, c, c, r);
  f.addColorStop(0, "rgba(0,0,0,1)");
  f.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = f;
  ctx.fillRect(c - r, c - r, r * 2, r * 2);
  ctx.restore();

  // A hairline ring, catching light from the upper left.
  const ring = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
  ring.addColorStop(0, "rgba(255,248,236,0.75)");
  ring.addColorStop(0.55, "rgba(255,248,236,0.22)");
  ring.addColorStop(1, "rgba(255,248,236,0.1)");
  ctx.beginPath();
  ctx.arc(c, c, r + 1.5, 0, TAU);
  ctx.lineWidth = 1;
  ctx.strokeStyle = ring;
  ctx.stroke();

  canvas.style.transform = `translate3d(${lens.x - c}px, ${lens.y - c}px, 0)`;
};

const placeLabels = () => {
  const r = lens.r;
  const a = Math.SQRT1_2 * (r + 12);
  powerEl.style.transform = `translate3d(${lens.x + a}px, ${lens.y + a}px, 0)`;
  powerEl.textContent = `${lens.m.toFixed(1)}×`;
  const right = lens.x + r + 330 < innerWidth;
  noteEl.classList.toggle("left", !right);
  const h = noteEl.offsetHeight;
  const nx = right ? lens.x + r + 26 : lens.x - r - 26 - 280;
  noteEl.style.transform = `translate3d(${nx}px, ${lens.y - h / 2}px, 0)`;
};

// --- loop -------------------------------------------------------------------
let last = performance.now();
let lastSig = "";
const loop = (now: number) => {
  const dt = Math.min(64, now - last);
  last = now;
  const ease = (ms: number) => (reduced ? 1 : 1 - Math.exp(-dt / ms));

  // Which detail (if any) is the pointer resting near?
  let target = { x: pointer.x, y: pointer.y };
  if (pointer.touch) target.y -= R + 40;
  let nextHot = -1;
  if (pointer.inside) {
    let best = Math.max(40, R * 0.55);
    works[active].details.forEach((_, k) => {
      const p = poiScreen(k);
      const dist = Math.hypot(p.x - target.x, p.y - target.y);
      if (dist < best) {
        best = dist;
        nextHot = k;
      }
    });
  }
  if (nextHot !== hot) {
    hot = nextHot;
    powerOverride = false;
    if (hot >= 0) {
      const d = works[active].details[hot];
      $("lp-note-k").textContent = `${roman[hot]} / ${roman[works[active].details.length - 1]} — ×${d.zoom}`;
      $("lp-note-t").textContent = d.note;
      noteEl.classList.add("on");
    } else noteEl.classList.remove("on");
  }
  let mTarget = userPower;
  if (hot >= 0) {
    // Settle gently onto the detail, at its own magnification.
    const p = poiScreen(hot);
    target = { x: target.x + (p.x - target.x) * 0.35, y: target.y + (p.y - target.y) * 0.35 };
    if (!powerOverride) mTarget = works[active].details[hot].zoom;
  }
  mTarget = Math.min(mTarget, maxPower());

  const visible = pointer.inside && now > swapUntil;
  lens.x += (target.x - lens.x) * ease(55);
  lens.y += (target.y - lens.y) * ease(55);
  lens.m += (mTarget - lens.m) * ease(140);
  lens.r += ((visible ? R : 0) - lens.r) * ease(visible ? 110 : 70);
  if (!visible && lens.r < 0.5) lens.r = 0;

  stage.classList.toggle("looking", pointer.inside);
  powerEl.classList.toggle("on", lens.r > R * 0.8 && (now < powerShownUntil || hot >= 0));
  // Only repaint when something visible changed.
  const sig = `${active}|${masters[active] ? 1 : 0}|${lens.x.toFixed(1)}|${lens.y.toFixed(1)}|${lens.r.toFixed(1)}|${lens.m.toFixed(3)}`;
  if (sig !== lastSig) {
    lastSig = sig;
    draw();
    placeLabels();
  }
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

// --- input ------------------------------------------------------------------
const insideFrame = (x: number, y: number) => {
  const fr = frames[active].getBoundingClientRect();
  return x >= fr.left && x <= fr.right && y >= fr.top && y <= fr.bottom;
};
const firstLook = () => root.classList.add("touched");

stage.addEventListener("pointermove", (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.touch = e.pointerType === "touch";
  const wasInside = pointer.inside;
  pointer.inside = insideFrame(e.clientX, e.clientY) && (e.pointerType !== "touch" || e.buttons > 0);
  if (pointer.inside && !wasInside && lens.r < 1) {
    // Appear where the eye is, rather than sliding in from the last spot.
    lens.x = pointer.x;
    lens.y = pointer.y - (pointer.touch ? R + 40 : 0);
  }
  if (pointer.inside) firstLook();
});
stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") {
    pointer.touch = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = insideFrame(e.clientX, e.clientY);
    lens.x = pointer.x;
    lens.y = pointer.y - R - 40;
  }
});
stage.addEventListener("pointerup", (e) => {
  if (e.pointerType === "touch") pointer.inside = false;
});
stage.addEventListener("pointerleave", () => (pointer.inside = false));

stage.addEventListener(
  "wheel",
  (e) => {
    if (!pointer.inside) return;
    e.preventDefault();
    if (hot >= 0 && !powerOverride) userPower = lens.m;
    powerOverride = true;
    userPower = Math.min(maxPower(), Math.max(1.5, userPower * Math.exp(-e.deltaY * 0.0018)));
    powerShownUntil = performance.now() + 1400;
  },
  { passive: false },
);

// Keyboard: focusing a point of interest puts the lens on it.
frames.forEach((f, i) =>
  f.querySelectorAll<HTMLButtonElement>(".lp-poi").forEach((b) => {
    const k = Number(b.dataset.k);
    const focusOn = () => {
      if (i !== active) return;
      const p = poiScreen(k);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.touch = false;
      if (!pointer.inside) {
        lens.x = p.x;
        lens.y = p.y;
      }
      pointer.inside = true;
    };
    b.addEventListener("focus", focusOn);
    b.addEventListener("click", focusOn);
    b.addEventListener("blur", () => (pointer.inside = false));
  }),
);

const show = (i: number) => {
  i = (i + works.length) % works.length;
  if (i === active) return;
  const now = performance.now();
  if (lens.r > 1) swapUntil = now + 420; // the lens blinks while the painting changes
  root.classList.add("swapping");
  frames[active].classList.remove("on");
  frames[active].setAttribute("aria-hidden", "true");
  frames[active].querySelectorAll<HTMLButtonElement>(".lp-poi").forEach((b) => (b.tabIndex = -1));
  active = i;
  root.dataset.active = String(i);
  frames[i].classList.add("on");
  frames[i].setAttribute("aria-hidden", "false");
  frames[i].querySelectorAll<HTMLButtonElement>(".lp-poi").forEach((b) => (b.tabIndex = 0));
  navButtons.forEach((b, k) => (k === i ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current")));
  loadMaster(i);
  hot = -2; // force the note to refresh
  setTimeout(() => {
    const w = works[i];
    $("lp-title").textContent = w.title;
    $("lp-by").textContent = `${w.artist}, ${w.year}`;
    $("lp-rights").textContent = w.rights;
    $("lp-source").textContent = w.source;
    $<HTMLAnchorElement>("lp-original").href = w.original;
    root.classList.remove("swapping");
  }, reduced ? 0 : 460);
};

navButtons.forEach((b) => b.addEventListener("click", () => show(Number(b.dataset.go))));
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") show(active + 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") show(active - 1);
  else if (e.key === "Escape") pointer.inside = false;
  else if (e.key === "+" || e.key === "=") {
    userPower = Math.min(maxPower(), userPower * 1.25);
    powerShownUntil = performance.now() + 1400;
  } else if (e.key === "-") {
    userPower = Math.max(1.5, userPower / 1.25);
    powerShownUntil = performance.now() + 1400;
  }
});


