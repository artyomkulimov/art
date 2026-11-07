/**
 * Behaviour for the wall (src/components/Wall.astro). The page is a normal
 * scrolling page; nothing pans.
 * - click a painting (or its tag, or its schedule row) and it lifts into the
 *   detail view while the grid stays exactly where it is
 * - scroll down (swipe up, Esc, ↓) and it drops back into its place
 * - ← → step through paintings in the detail view
 * - quiet touches: the axis nearest the cursor lights up, and hovering a
 *   painting lights its tag, schedule row and axis bubble
 */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Scroll distance in the detail view that puts the painting back (px). */
const RETURN_AT = 150;

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = matchMedia("(max-width: 760px)");

const root = document.documentElement;
const sheet = document.getElementById("sheet") as HTMLElement;
const content = document.getElementById("content") as HTMLElement;
const view = document.getElementById("view") as HTMLElement;
const vnum = document.getElementById("vnum") as HTMLElement;
const works = [...content.querySelectorAll<HTMLAnchorElement>(".work")];
const details = [...view.querySelectorAll<HTMLElement>(".detail")];
const ids = details.map((d) => d.dataset.id ?? "");
const axes = [...sheet.querySelectorAll<HTMLElement>(".axis")];
const bubbles = [...sheet.querySelectorAll<HTMLElement>(".bubble")];
const siteTitle = view.dataset.siteTitle ?? document.title;
const count = String(works.length).padStart(2, "0");

let current = Number(view.dataset.open ?? -1);
let busy = false;

/* ----------------------------------------------------------- grid touches */

const mark = (list: HTMLElement[], cls: string, k: number) => {
  for (const [j, el] of list.entries()) {
    el.classList.toggle(cls, j === k);
  }
};

/** The axis a painting hangs on, for the current layout. */
const axisOf = (i: number) => {
  const w = works[i];
  return Math.round(Number(narrow.matches ? w.dataset.maxis : w.dataset.axis));
};

let aimRaf = 0;
let aimX = -1;
const showAim = () => {
  aimRaf = 0;
  if (aimX < 0 || current >= 0) {
    mark(axes, "near", -1);
    mark(bubbles, "near", -1);
    return;
  }
  const r = sheet.getBoundingClientRect();
  const cols = narrow.matches ? 4 : 12;
  const k = Math.round(((aimX - r.left) / r.width) * cols);
  const near = k >= 0 && k <= cols ? k : -1;
  mark(axes, "near", near);
  mark(bubbles, "near", near);
};
const aim = (x: number) => {
  aimX = x;
  if (!aimRaf) {
    aimRaf = requestAnimationFrame(showAim);
  }
};
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch") {
    aim(e.clientX);
  }
});
document.addEventListener("pointerleave", () => aim(-1));

/** Light everything tied to painting i: painting, tag, schedule row, bubble. */
const hot = (i: number, on: boolean) => {
  for (const el of content.querySelectorAll(`[data-i="${i}"]`)) {
    el.classList.toggle("hot", on);
  }
  mark(bubbles, "lit", on ? axisOf(i) : -1);
};

/* ------------------------------------------------------------ detail view */

const frameOf = (i: number) => works[i].querySelector(".frame") as HTMLElement;
const figOf = (i: number) => details[i].querySelector(".fig") as HTMLElement;

/** Start fetching painting i's large image. */
const warm = (i: number) => {
  const img = details[i].querySelector("img");
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

/* Swallow the tail of trackpad momentum after putting a painting back, so
   the page stays exactly where it was. */
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
    if (current < 0 && t < guardUntil && t < guardCap) {
      e.preventDefault();
      guardUntil = t + 160;
    }
  },
  { passive: false }
);

const open = (i: number, push = true) => {
  if (busy || current >= 0) {
    return;
  }
  busy = true;
  current = i;
  hot(i, false);
  aim(-1);
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
  view.focus({ preventScroll: true });
  if (reduce) {
    busy = false;
    return;
  }
  fig
    .animate(
      [
        { transform: flip(from, to), filter: "brightness(0.88)" },
        { transform: "none", filter: "none" },
      ],
      {
        duration: 760,
        easing: EASE,
      }
    )
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
  // Freeze the scroll-to-return nudge where it is, so nothing else moves the
  // painting while it flies home (otherwise it lands off and snaps).
  const detail = details[i];
  detail.style.transition = "none";
  detail.style.transform = getComputedStyle(detail).transform;
  const from = fig.getBoundingClientRect();
  const to = frameOf(i).getBoundingClientRect();
  view.classList.remove("in");
  root.classList.remove("is-open");
  label(-1);
  const done = () => {
    view.hidden = true;
    works[i].classList.remove("away");
    for (const a of fig.getAnimations()) {
      a.cancel();
    }
    detail.style.removeProperty("transition");
    detail.style.removeProperty("transform");
    progress(0);
    current = -1;
    busy = false;
    guardWheel();
    works[i].focus({ preventScroll: true });
  };
  if (reduce) {
    done();
    return;
  }
  fig
    .animate(
      [
        { transform: "none", filter: "none" },
        { transform: flip(to, from), filter: "brightness(0.88)" },
      ],
      {
        duration: 680,
        easing: EASE,
        fill: "forwards",
      }
    )
    .finished.catch(() => undefined)
    .then(done);
};

/** Back to the wall, through history when we came from it. */
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

/* --------------------------------------------------------------- wiring */

for (const el of content.querySelectorAll<HTMLAnchorElement>("a[data-i]")) {
  const i = Number(el.dataset.i);
  el.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    open(i);
  });
  el.addEventListener("pointerenter", () => {
    warm(i);
    hot(i, true);
  });
  el.addEventListener("pointerleave", () => hot(i, false));
  el.addEventListener("focus", () => hot(i, true));
  el.addEventListener("blur", () => hot(i, false));
}

for (const b of view.querySelectorAll<HTMLElement>("[data-close]")) {
  b.addEventListener("click", leave);
}
for (const b of view.querySelectorAll<HTMLElement>("[data-step]")) {
  b.addEventListener("click", () => step(Number(b.dataset.step)));
}
// Clicking empty space around the painting also puts it back.
view.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (
    t === view ||
    t.classList.contains("vsheet") ||
    t.classList.contains("detail")
  ) {
    leave();
  }
});

// Scroll down to put it back.
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

// Swipe up to put it back (touch).
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
