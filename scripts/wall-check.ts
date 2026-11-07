/**
 * Walks through the wall: load, hover, drag + spring back, open a painting,
 * scroll back, direct link, mobile. Screenshots go to /tmp/wall-check/.
 *
 *   bun scripts/wall-check.ts [--base http://127.0.0.1:4321]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = args.includes("--base")
  ? args[args.indexOf("--base") + 1]
  : "http://127.0.0.1:4321";
const out = "/tmp/wall-check";
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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(page);
await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 120_000 });
await sleep(2600);
await page.screenshot({ path: `${out}/01-home.png` });
await page.screenshot({ path: `${out}/02-full.png`, fullPage: true });

const box = await page.locator(".work").nth(0).boundingBox();
if (!box) {
  throw new Error("no work");
}
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await sleep(700);
await page.screenshot({ path: `${out}/03-hover.png` });

// drag the sheet from an empty spot
await page.mouse.move(300, 820);
await page.mouse.down();
for (let k = 1; k <= 20; k++) {
  await page.mouse.move(300 + k * 12, 820 - k * 5);
  await sleep(16);
}
await page.mouse.up();
await sleep(200);
await page.screenshot({ path: `${out}/04-dragged.png` });
console.log(
  "offset after drag:",
  await page.evaluate(
    () => (document.getElementById("sheet") as HTMLElement).style.translate
  )
);
await sleep(2600);
console.log(
  "offset after idle:",
  JSON.stringify(
    await page.evaluate(
      () => (document.getElementById("sheet") as HTMLElement).style.translate
    )
  )
);

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
await mobile.screenshot({ path: `${out}/11-mobile.png`, fullPage: true });
await mobile.goto(`${base}/pandemonium/`, {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await sleep(1500);
await mobile.screenshot({ path: `${out}/12-mobile-open.png` });

await browser.close();
console.log(errors.length ? `errors:\n  ${errors.join("\n  ")}` : "no errors");
