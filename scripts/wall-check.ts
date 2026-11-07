/**
 * Walks through the wall: load, hover, open a painting,
 * scroll back, direct link, mobile. Screenshots go to $OUT (default /tmp/wall-check-claude/).
 *
 *   bun scripts/wall-check.ts [--base http://127.0.0.1:4321]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://127.0.0.1:4321";
const out = process.env.OUT ?? "/tmp/wall-check-claude";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors: string[] = [];
const watch = (page: import("playwright").Page) => {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on(
    "console",
    (m) => m.type() === "error" && errors.push(`console: ${m.text()}`)
  );
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Whole-page shot via a tall viewport (full-page capture drops layers in headless). */
const tall = async (pg: import("playwright").Page, path: string) => {
  const vp = pg.viewportSize() ?? { width: 1440, height: 900 };
  const h = await pg.evaluate(() => document.documentElement.scrollHeight);
  await pg.setViewportSize({ width: vp.width, height: h });
  await sleep(400);
  await pg.screenshot({ path });
  await pg.setViewportSize(vp);
  await sleep(200);
};

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(page);
await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 120_000 });
await sleep(2600);
await page.screenshot({ path: `${out}/01-home.png` });
await tall(page, `${out}/02-full.png`);

const box = await page.locator(".work").nth(0).boundingBox();
if (!box) {
  throw new Error("no work");
}
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await sleep(700);
await page.screenshot({ path: `${out}/03-hover.png` });

// hover a schedule row
await page.locator(".row[data-i='1']").hover();
await sleep(600);
await tall(page, `${out}/04-row-hover.png`);
await page.evaluate(() => scrollTo(0, 0));
await sleep(300);

// open a painting
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await sleep(350);
await page.screenshot({ path: `${out}/05-opening.png` });
await sleep(1200);
await page.screenshot({ path: `${out}/06-open.png` });
console.log("url when open:", page.url());
await page.keyboard.press("ArrowRight");
await sleep(900);
await page.screenshot({ path: `${out}/07-next.png` });
for (let k = 0; k < 8; k++) {
  await page.mouse.wheel(0, 30);
  await sleep(20);
}
await sleep(300);
await page.screenshot({ path: `${out}/08-returning.png` });
await sleep(1200);
await page.screenshot({ path: `${out}/09-back.png` });
console.log(
  "url after return:",
  page.url(),
  "scrollY",
  await page.evaluate(() => scrollY)
);

// direct link
const direct = await browser.newPage({
  viewport: { width: 1440, height: 900 },
});
watch(direct);
await direct.goto(`${base}/wet-moon-putney-road/`, {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await sleep(1500);
await direct.screenshot({ path: `${out}/10-direct.png` });

// mobile
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});
watch(mobile);
await mobile.goto(`${base}/`, { waitUntil: "networkidle", timeout: 120_000 });
await sleep(2600);
await tall(mobile, `${out}/11-mobile.png`);
await mobile.goto(`${base}/pandemonium/`, {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await sleep(1500);
await mobile.screenshot({ path: `${out}/12-mobile-open.png` });

await browser.close();
console.log(errors.length ? `errors:\n  ${errors.join("\n  ")}` : "no errors");
