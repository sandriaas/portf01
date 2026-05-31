// Targeted hero h1 inspector — compares live and local at desktop.
import { chromium } from "playwright";

const VIEW = { width: 1440, height: 900 };
const URLS = {
  live: "https://www.x29.ai/",
  local: "http://localhost:3000/",
};

const probe = async (label, url) => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(
    () => document.documentElement.className.includes("w-mod-ix3"),
    { timeout: 5000 },
  ).catch(() => {});
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    const tracks = [
      "section.hero-home-section",
      "section.hero-home-section .home-hero-wrap",
      "section.hero-home-section .headline-home-hero",
      "section.hero-home-section h1",
      "section.hero-home-section .x29-home-hero-content",
      "section.hero-home-section .main-container",
      "section.hero-home-section .video-home-hero",
      "section.hero-home-section .x29-home-hero-media",
      "section.hero-home-section .x29-home-hero-stack",
      ".cta-main",
      ".home-hero-bottom-tile",
    ];
    const out = {};
    for (const sel of tracks) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[sel] = {
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        display: cs.display,
        position: cs.position,
        flexDirection: cs.flexDirection,
        justifyContent: cs.justifyContent,
        alignItems: cs.alignItems,
        textAlign: cs.textAlign,
        margin: cs.margin,
        padding: cs.padding,
        marginLeft: cs.marginLeft,
        marginRight: cs.marginRight,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        width: cs.width,
        maxWidth: cs.maxWidth,
        transform: cs.transform,
        transformOrigin: cs.transformOrigin,
        outerHTML:
          el.outerHTML.length < 1500
            ? el.outerHTML
            : el.outerHTML.slice(0, 1500) + "…",
      };
    }
    return out;
  });

  await ctx.close();
  await browser.close();
  return { label, url, data };
};

const live = await probe("live", URLS.live);
const local = await probe("local", URLS.local);

const all = new Set([
  ...Object.keys(live.data),
  ...Object.keys(local.data),
]);
for (const sel of all) {
  const a = live.data[sel];
  const b = local.data[sel];
  console.log("\n===", sel, "===");
  if (!a) {
    console.log("  live: missing");
  } else {
    console.log(
      `  live  rect: x=${a.rect.x.toFixed(1)} y=${a.rect.y.toFixed(1)} w=${a.rect.width.toFixed(1)} h=${a.rect.height.toFixed(1)}`,
    );
  }
  if (!b) {
    console.log("  local: missing");
  } else {
    console.log(
      `  local rect: x=${b.rect.x.toFixed(1)} y=${b.rect.y.toFixed(1)} w=${b.rect.width.toFixed(1)} h=${b.rect.height.toFixed(1)}`,
    );
  }
  if (a && b) {
    const dx = (b.rect.x - a.rect.x).toFixed(1);
    const dy = (b.rect.y - a.rect.y).toFixed(1);
    const dw = (b.rect.width - a.rect.width).toFixed(1);
    console.log(`  Δ x=${dx} y=${dy} w=${dw}`);
    const keys = [
      "display","position","flexDirection","justifyContent","alignItems",
      "textAlign","margin","padding","marginLeft","marginRight",
      "paddingLeft","paddingRight","width","maxWidth","transform",
    ];
    for (const k of keys) {
      if (a[k] !== b[k]) console.log(`  ${k}: ${a[k]}  →  ${b[k]}`);
    }
  }
}
