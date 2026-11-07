/**
 * Behaviour for the wall (src/components/Wall.astro):
 * - drag the sheet (mouse/pen) or swipe sideways on a trackpad; when left
 *   alone it springs back home, a little rubbery
 * - click a painting and it lifts into the detail view; scroll down (or swipe
 *   up, or Esc) and it drops back into its place on the sheet
 * - small live touches: cursor read-out on the rulers, shimmering ASCII strip
 */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** How long the sheet waits, untouched, before springing home (ms). */
const IDLE = 1100;
/** Scroll distance in the detail view that sends you back to the wall (px). */
const RETURN_AT = 150;

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = matchMedia("(max-width: 760px)");

const root = document.documentElement;
const sheet = document.getElementById("sheet") as HTMLElement;
const view = document.getElementById("view") as HTMLElement;
const hud = document.getElementById("hud") as HTMLElement;
const vnum = document.getElementById("vnum") as HTMLElement;
const works = [...sheet.querySelectorAll<HTMLAnchorElement>(".work")];
const details = [...view.querySelectorAll<HTMLElement>(".detail")];
const ids = works.map((w) => w.dataset.id ?? "");
const siteTitle = view.dataset.siteTitle ?? document.title;
const count = String(works.length).padStart(2, "0");

/* ------------------------------------------------------------------ sheet */

const offset = { x: 0, y: 0 };
const vel = { x: 0, y: 0 };
type Mode = "rest" | "drag" | "glide" | "wait" | "spring";
let mode: Mode = "rest";
let waitUntil = 0;
let raf = 0;
let last = 0;

/** Soft limit: the further you pull, the harder it gets. */
const RUBBER = 380;
const rubber = (v: number) => RUBBER * Math.tanh(v / RUBBER);

const paint = () => {
  sheet.style.translate =
    offset.x || offset.y ? `${rubber(offset.x)}px ${rubber(offset.y)}px` : "";
};

const settle = () => {
  offset.x = 0;
  offset.y = 0;
  vel.x = 0;
  vel.y = 0;
  mode = "rest";
};

const loop = (t: number) => {
  const dt = Math.min(0.034, (t - last) / 1000 || 0.016);
  last = t;
  if (mode === "glide") {
    offset.x += vel.x * dt;
    offset.y += vel.y * dt;
    const f = Math.exp(-7 * dt);
    vel.x *= f;
    vel.y *= f;
    if (Math.hypot(vel.x, vel.y) < 12) {
      mode = "wait";
      waitUntil = t + IDLE;
    }
  } else if (mode === "wait") {
    if (t >= waitUntil) {
      mode = "spring";
      vel.x = 0;
      vel.y = 0;
    }
  } else if (mode === "spring") {
    // Under-damped spring: overshoots home a touch, then settles.
    const k = 120;
    const c = 2 * Math.sqrt(k) * 0.55;
    for (const a of ["x", "y"] as const) {
      vel[a] += (-k * offset[a] - c * vel[a]) * dt;
      offset[a] += vel[a] * dt;
    }
    if (Math.hypot(offset.x, offset.y) < 0.3 && Math.hypot(vel.x, vel.y) < 3) {
      settle();
    }
  }
  paint();
  raf = mode === "rest" || mode === "drag" ? 0 : requestAnimationFrame(loop);
};

const run = (m: Mode) => {
  mode = m;
  if (reduce && m !== "drag") {
    settle();
    paint();
    return;
  }
  if (!raf && m !== "rest" && m !== "drag") {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
};

const stop = () => {
  cancelAnimationFrame(raf);
  raf = 0;
};

interface Press {
  id: number;
  moved: boolean;
  ox: number;
  oy: number;
  samples: { t: number; x: number; y: number }[];
  x: number;
  y: number;
}
let press: Press | null = null;
let swallowClick = false;

sheet.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" || e.button !== 0 || current >= 0) {
    return;
  }
  swallowClick = false;
  stop();
  mode = "drag";
  vel.x = 0;
  vel.y = 0;
  press = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    ox: offset.x,
    oy: offset.y,
    moved: false,
    samples: [],
  };
});

addEventListener("pointermove", (e) => {
  if (!press || e.pointerId !== press.id) {
    return;
  }
  const dx = e.clientX - press.x;
  const dy = e.clientY - press.y;
  if (!press.moved) {
    if (Math.hypot(dx, dy) < 5) {
      return;
    }
    press.moved = true;
    sheet.setPointerCapture(e.pointerId);
    root.classList.add("dragging");
  }
  offset.x = press.ox + dx;
  offset.y = press.oy + dy;
  paint();
  press.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
  while (press.samples.length > 2 && e.timeStamp - press.samples[0].t > 90) {
    press.samples.shift();
  }
});

const release = (e: PointerEvent) => {
  if (!press || e.pointerId !== press.id) {
    return;
  }
  const p = press;
  press = null;
  if (p.moved) {
    swallowClick = true;
    root.classList.remove("dragging");
    const a = p.samples[0];
    const b = p.samples.at(-1);
    if (a && b && b.t > a.t && e.timeStamp - b.t < 60) {
      vel.x = ((b.x - a.x) / (b.t - a.t)) * 1000;
      vel.y = ((b.y - a.y) / (b.t - a.t)) * 1000;
    }
  }
  if (!(offset.x || offset.y)) {
    mode = "rest";
    return;
  }
  waitUntil = performance.now() + IDLE;
  run(Math.hypot(vel.x, vel.y) > 60 ? "glide" : "wait");
};
addEventListener("pointerup", release);
addEventListener("pointercancel", release);

// A drag that ends over a painting must not open it.
sheet.addEventListener(
  "click",
  (e) => {
    if (swallowClick) {
      e.preventDefault();
      e.stopImmediatePropagation();
      swallowClick = false;
    }
  },
  true
);

/* Swallow the tail of trackpad momentum after returning to the wall, so the
   page stays exactly where it was. */
let guardUntil = 0;
let guardCap = 0;
const guardWheel = () => {
  const t = performance.now();
  guardUntil = t + 350;
  guardCap = t + 1500;
};

addEventListener(
  "wheel",
  (e) => {
    const t = performance.now();
    if (t < guardUntil && t < guardCap) {
      e.preventDefault();
      guardUntil = t + 160;
      return;
    }
    if (current >= 0 || e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
      return;
    }
    // Sideways swipe: nudge the sheet (and stop the browser's back gesture).
    e.preventDefault();
    stop();
    offset.x -= e.deltaX;
    vel.x = 0;
    vel.y = 0;
    paint();
    waitUntil = t + IDLE;
    run("wait");
  },
  { passive: false }
);

/* ------------------------------------------------------------- read-outs */

let aimRaf = 0;
let aim: PointerEvent | null = null;
const pad4 = (v: number) => String(Math.max(0, Math.round(v))).padStart(3, "0");

const showAim = () => {
  aimRaf = 0;
  if (!aim) {
    return;
  }
  const r = sheet.getBoundingClientRect();
  const x = aim.clientX - r.left;
  const y = aim.clientY - r.top;
  sheet.style.setProperty("--cx", `${x}px`);
  sheet.style.setProperty("--cy", `${y}px`);
  const small = narrow.matches;
  const perMeter = Number(small ? sheet.dataset.mpm : sheet.dataset.dpm);
  const pxPerCm = ((r.width / (small ? 4 : 12)) * perMeter) / 100;
  hud.textContent = `x ${pad4(x / pxPerCm)}  y ${pad4(y / pxPerCm)} cm`;
};

sheet.addEventListener("pointermove", (e) => {
  aim = e;
  sheet.classList.add("aim");
  hud.classList.add("live");
  if (!aimRaf) {
    aimRaf = requestAnimationFrame(showAim);
  }
});
sheet.addEventListener("pointerleave", () => {
  aim = null;
  sheet.classList.remove("aim");
  hud.classList.remove("live");
});

/** Highlight everything tied to painting i: its plot, its strip of ASCII. */
const hot = (i: number, on: boolean) => {
  for (const el of sheet.querySelectorAll(`[data-i="${i}"]`)) {
    el.classList.toggle("hot", on);
  }
};

if (!reduce) {
  const runs = [
    ...sheet.querySelectorAll<HTMLElement>(".strip [class^='t']"),
  ].filter((s) => s.textContent?.trim());
  const original = new Map(runs.map((s) => [s, s.textContent ?? ""]));
  const swap: Record<string, string> = {
    "·": ":",
    ":": "·",
    "-": "+",
    "+": "*",
    "*": "+",
    o: "*",
  };
  const put = (s: HTMLElement, i: number, ch: string) => {
    const t = s.textContent ?? "";
    s.textContent = t.slice(0, i) + ch + t.slice(i + 1);
  };
  setInterval(() => {
    if (document.hidden || current >= 0 || runs.length === 0) {
      return;
    }
    for (let k = 0; k < 3; k++) {
      const s = runs[Math.floor(Math.random() * runs.length)];
      const text = original.get(s) ?? "";
      const i = Math.floor(Math.random() * text.length);
      const ch = text[i];
      if (!ch || ch === " ") {
        continue;
      }
      put(s, i, swap[ch] ?? "·");
      setTimeout(() => put(s, i, ch), 450 + Math.random() * 700);
    }
  }, 130);
}

/* ------------------------------------------------------------ detail view */

let current = Number(view.dataset.open ?? -1);
let busy = false;

const frameOf = (i: number) => works[i].querySelector(".frame") as HTMLElement;
const figOf = (i: number) => details[i].querySelector(".fig") as HTMLElement;
const bigImg = (i: number) => details[i].querySelector("img");

/** Start fetching painting i's large image. */
const warm = (i: number) => {
  const img = bigImg(i);
  if (img && img.loading !== "eager") {
    img.loading = "eager";
  }
};

/** Transform that makes a box laid out at `to` appear at `from`. */
const flip = (from: DOMRect, to: DOMRect) =>
  `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

const label = (i: number) => {
  vnum.textContent = `${String(i + 1).padStart(2, "0")} / ${count}`;
  document.title =
    i < 0 ? siteTitle : `${details[i].dataset.title} — ${siteTitle}`;
};

const showDetail = (i: number) => {
  for (const [j, d] of details.entries()) {
    d.hidden = j !== i;
  }
  // While the big image loads, show the wall's copy underneath it.
  const small = frameOf(i).querySelector("img")?.currentSrc;
  if (small) {
    figOf(i).style.backgroundImage = `url("${small}")`;
  }
};

const progress = (p: number) =>
  view.style.setProperty("--p", String(Math.max(0, Math.min(1, p))));

const open = (i: number, push = true) => {
  if (busy || current >= 0) {
    return;
  }
  busy = true;
  current = i;
  stop();
  warm(i);
  const from = frameOf(i).getBoundingClientRect();
  showDetail(i);
  view.hidden = false;
  root.classList.add("is-open");
  works[i].classList.add("away");
  const fig = figOf(i);
  const to = fig.getBoundingClientRect();
  progress(0);
  view.getBoundingClientRect();
  view.classList.add("in");
  if (push) {
    history.pushState({ wall: true }, "", `/${ids[i]}/`);
  }
  label(i);
  (view.querySelector("[data-close]") as HTMLElement | null)?.focus({
    preventScroll: true,
  });
  if (reduce) {
    busy = false;
    return;
  }
  fig
    .animate([{ transform: flip(from, to) }, { transform: "none" }], {
      duration: 780,
      easing: EASE,
    })
    .finished.catch(() => undefined)
    .then(() => {
      busy = false;
    });
};

const close = () => {
  if (current < 0) {
    return;
  }
  busy = true;
  const i = current;
  const fig = figOf(i);
  const from = fig.getBoundingClientRect();
  const to = frameOf(i).getBoundingClientRect();
  view.classList.remove("in");
  label(-1);
  const done = () => {
    view.hidden = true;
    root.classList.remove("is-open");
    works[i].classList.remove("away");
    for (const a of fig.getAnimations()) {
      a.cancel();
    }
    progress(0);
    current = -1;
    busy = false;
    guardWheel();
    works[i].focus({ preventScroll: true });
    if (offset.x || offset.y) {
      waitUntil = performance.now() + IDLE / 2;
      run("wait");
    }
  };
  if (reduce) {
    done();
    return;
  }
  fig
    .animate([{ transform: "none" }, { transform: flip(to, from) }], {
      duration: 680,
      easing: EASE,
      fill: "forwards",
    })
    .finished.catch(() => undefined)
    .then(done);
};

/** Go back to the wall, through history when we came from it. */
const leave = () => {
  if (current < 0 || busy) {
    return;
  }
  if (history.state?.wall) {
    history.back();
  } else {
    history.pushState(null, "", "/");
    close();
  }
};

const swapTo = (j: number, dir: number) => {
  const i = current;
  if (j === i) {
    return;
  }
  busy = true;
  warm(j);
  works[i].classList.remove("away");
  works[j].classList.add("away");
  current = j;
  label(j);
  const finish = () => {
    showDetail(j);
    if (!reduce) {
      details[j].animate(
        [
          { opacity: 0, translate: `${dir * 14}px 0` },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 460, easing: EASE }
      );
    }
    busy = false;
  };
  if (reduce) {
    finish();
    return;
  }
  details[i]
    .animate([{ opacity: 1 }, { opacity: 0, translate: `${-dir * 10}px 0` }], {
      duration: 170,
      easing: "ease-in",
    })
    .finished.catch(() => undefined)
    .then(finish);
};

const step = (dir: number) => {
  if (current < 0 || busy) {
    return;
  }
  const j = (current + dir + works.length) % works.length;
  history.replaceState(history.state, "", `/${ids[j]}/`);
  swapTo(j, dir);
};

addEventListener("popstate", () => {
  const i = ids.indexOf(location.pathname.split("/").filter(Boolean)[0] ?? "");
  if (i < 0) {
    close();
  } else if (current < 0) {
    open(i, false);
  } else {
    swapTo(i, i > current ? 1 : -1);
  }
});

for (const [i, w] of works.entries()) {
  w.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    open(i);
  });
  w.addEventListener("pointerenter", () => {
    warm(i);
    hot(i, true);
  });
  w.addEventListener("pointerleave", () => hot(i, false));
  w.addEventListener("focus", () => hot(i, true));
  w.addEventListener("blur", () => hot(i, false));
}

for (const b of document.querySelectorAll<HTMLElement>(
  "[data-open]:not(#view)"
)) {
  b.addEventListener("click", (e) => {
    e.preventDefault();
    open(Number(b.dataset.open));
  });
}
for (const b of view.querySelectorAll<HTMLElement>("[data-close]")) {
  b.addEventListener("click", leave);
}
for (const b of view.querySelectorAll<HTMLElement>("[data-step]")) {
  b.addEventListener("click", () => step(Number(b.dataset.step)));
}
// Clicking empty space around the painting also returns to the wall.
view.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (
    t === view ||
    t.classList.contains("detail") ||
    t.classList.contains("stage")
  ) {
    leave();
  }
});

// Scroll down to return.
let pull = 0;
let pullTimer = 0;
view.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (busy || current < 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      return;
    }
    pull = Math.max(0, pull + e.deltaY * (e.deltaMode === 1 ? 32 : 1));
    progress(pull / RETURN_AT);
    clearTimeout(pullTimer);
    if (pull >= RETURN_AT) {
      pull = 0;
      leave();
      return;
    }
    pullTimer = window.setTimeout(() => {
      pull = 0;
      progress(0);
    }, 260);
  },
  { passive: false }
);

// Swipe up to return (touch).
let touchY = -1;
view.addEventListener(
  "touchstart",
  (e) => {
    touchY = e.touches[0].clientY;
  },
  { passive: true }
);
view.addEventListener(
  "touchmove",
  (e) => {
    if (touchY < 0) {
      return;
    }
    e.preventDefault();
    progress((touchY - e.touches[0].clientY) / 110);
  },
  { passive: false }
);
view.addEventListener("touchend", (e) => {
  const d = touchY - e.changedTouches[0].clientY;
  touchY = -1;
  if (d > 90) {
    leave();
  } else {
    progress(0);
  }
});

addEventListener("keydown", (e) => {
  if (current < 0 || e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  if (e.key === "Escape" || e.key === "ArrowDown" || e.key === "PageDown") {
    e.preventDefault();
    leave();
  } else if (e.key === "ArrowRight") {
    step(1);
  } else if (e.key === "ArrowLeft") {
    step(-1);
  }
});

// Fetch the large images quietly once the page has settled.
addEventListener("load", () => {
  setTimeout(() => {
    for (const i of works.keys()) {
      warm(i);
    }
  }, 2500);
});
