// Dumps the live x29 hero section outerHTML so we can mirror its tree.
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto("https://www.x29.ai/", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);

const html = await page.evaluate(() => {
  const el = document.querySelector("section.hero-home-section");
  return el ? el.outerHTML : null;
});

console.log(html);
await ctx.close();
await browser.close();
