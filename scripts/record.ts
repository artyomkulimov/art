/**
 * Records a demo video of one or more idea pages.
 *
 *   bun scripts/record.ts <slug> [<slug> ...] [--base http://localhost:4321] [--shots-only]
 *
 * For each slug it opens /ideas/<slug>/ at 1440×900, runs scripts/demos/<slug>.ts,
 * and writes demos/<slug>.mp4 plus any screenshots the demo takes to demos/<slug>/.
 * A fake cursor is drawn so hover effects read on video.
 */
import { linkSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Page } from "playwright";

const FFMPEG =
  process.env.FFMPEG ??
  "/home/wumpie/.cache/art-ffmpeg-venv/lib/python3.12/site-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v9.0.2";
const W = 1440;
const H = 900;
const FPS = 30;

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "http://localhost:4321";
const shotsOnly = args.includes("--shots-only");
const slugs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");
if (slugs.length === 0) {
  console.error("usage: bun scripts/record.ts <slug> [...] [--base url] [--shots-only]");
  process.exit(1);
}

const root = resolve(import.meta.dir, "..");

const cursorScript = `
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div");
    c.id = "__demo_cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.9);mix-blend-mode:difference;pointer-events:none;z-index:2147483647;transition:transform .12s;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(c);
    addEventListener("mousemove", (e) => { c.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, { capture: true, passive: true });
    addEventListener("mousedown", () => { c.style.scale = ".6"; }, true);
    addEventListener("mouseup", () => { c.style.scale = "1"; }, true);
  });
`;

export type DemoHelpers = {
  page: Page;
  /** Move the mouse smoothly to (x, y) over `ms`. */
  glide: (x: number, y: number, ms?: number) => Promise<void>;
  /** Scroll smoothly by `dy` pixels over `ms` using wheel events. */
  scrollBy: (dy: number, ms?: number, dx?: number) => Promise<void>;
  wait: (ms: number) => Promise<void>;
  /** Click at the current mouse position (or at x, y). */
  click: (x?: number, y?: number) => Promise<void>;
  /** Save a screenshot to demos/<slug>/<name>.png (for reviewing your work). */
  shot: (name: string) => Promise<void>;
  key: (key: string) => Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const recordOne = async (slug: string) => {
  const outDir = join(root, "demos", slug);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, "frames"), { recursive: true });

  const browser = await chromium.launch({
    args: ["--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--disable-renderer-backgrounding"],
  });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await context.addInitScript(cursorScript);
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(`[${slug}] page error:`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(`[${slug}] console:`, m.text());
  });

  const mod = await import(join(root, "scripts", "demos", `${slug}.ts`));
  const demo: (h: DemoHelpers) => Promise<void> = mod.default;

  let mouse = { x: W / 2, y: H / 2 };
  const helpers: DemoHelpers = {
    page,
    wait: sleep,
    glide: async (x, y, ms = 800) => {
      const steps = Math.max(1, Math.round(ms / 16));
      const from = { ...mouse };
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        await sleep(16);
      }
      mouse = { x, y };
    },
    scrollBy: async (dy, ms = 1200, dx = 0) => {
      const steps = Math.max(1, Math.round(ms / 16));
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(dx / steps, dy / steps);
        await sleep(16);
      }
    },
    click: async (x, y) => {
      if (x !== undefined && y !== undefined) {
        await helpers.glide(x, y, 500);
      }
      await page.mouse.down();
      await sleep(90);
      await page.mouse.up();
    },
    shot: async (name) => {
      await page.screenshot({ path: join(outDir, `${name}.png`) });
    },
    key: async (key) => {
      await page.keyboard.press(key);
    },
  };

  await page.goto(`${base}/ideas/${slug}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(mouse.x, mouse.y);

  const frames: { file: string; ts: number }[] = [];
  let cdp: Awaited<ReturnType<typeof context.newCDPSession>> | undefined;
  if (!shotsOnly) {
    cdp = await context.newCDPSession(page);
    let n = 0;
    cdp.on("Page.screencastFrame", async (f) => {
      const file = join(outDir, "frames", `${String(n++).padStart(5, "0")}.jpg`);
      writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, ts: f.metadata.timestamp ?? Date.now() / 1000 });
      try {
        await cdp?.send("Page.screencastFrameAck", { sessionId: f.sessionId });
      } catch {
        // session closed
      }
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  }

  const started = Date.now();
  await demo(helpers);
  const endTs = Date.now() / 1000;

  if (cdp) {
    await cdp.send("Page.stopScreencast");
  }
  await browser.close();

  if (!shotsOnly && frames.length > 0) {
    // Screencast frames arrive only when the screen changes. Resample them to a
    // constant FPS by hard-linking the latest frame shown at each output tick.
    const cfrDir = join(outDir, "cfr");
    mkdirSync(cfrDir, { recursive: true });
    const t0 = frames[0].ts;
    const total = Math.ceil((endTs - t0) * FPS);
    let src = 0;
    for (let k = 0; k < total; k++) {
      const t = t0 + k / FPS;
      while (src + 1 < frames.length && frames[src + 1].ts <= t) src++;
      linkSync(frames[src].file, join(cfrDir, `${String(k).padStart(6, "0")}.jpg`));
    }
    const out = join(root, "demos", `${slug}.mp4`);
    const r = spawnSync(
      FFMPEG,
      ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(cfrDir, "%06d.jpg"), "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out],
      { stdio: "inherit" },
    );
    rmSync(join(outDir, "frames"), { recursive: true, force: true });
    rmSync(cfrDir, { recursive: true, force: true });
    if (r.status !== 0) throw new Error(`ffmpeg failed for ${slug}`);
    console.log(`[${slug}] ${frames.length} frames over ${((Date.now() - started) / 1000).toFixed(1)}s → ${out}`);
  } else {
    rmSync(join(outDir, "frames"), { recursive: true, force: true });
    console.log(`[${slug}] screenshots in ${outDir}`);
  }
};

for (const slug of slugs) {
  await recordOne(slug);
}
