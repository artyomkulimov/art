/**
 * Smoke-tests idea pages: loads each one at 1440×900, reports page/console
 * errors, and saves a screenshot to /tmp/art-check/<slug>.png.
 *
 *   bun scripts/check.ts [slug ...] [--base http://127.0.0.1:4321]
 */
import { mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args[baseIdx + 1] : "http://127.0.0.1:4321";
let slugs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");
if (slugs.length === 0) {
  slugs = readdirSync(resolve(import.meta.dir, "../src/pages/ideas"))
    .filter((f) => f.endsWith(".astro"))
    .map((f) => f.replace(/\.astro$/, ""));
}

const out = "/tmp/art-check";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

const checkOne = async (slug: string) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${base}/ideas/${slug}/`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/${slug}.png` });
  await page.close();
  console.log(`${errors.length ? "✗" : "✓"} ${slug}${errors.length ? `\n    ${errors.join("\n    ")}` : ""}`);
};

for (let i = 0; i < slugs.length; i += 4) {
  await Promise.all(slugs.slice(i, i + 4).map(checkOne));
}
await browser.close();
