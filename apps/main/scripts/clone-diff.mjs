// Live vs local diff harness for the clone-website skill.
// Captures full-page screenshots, hero geometry, navbar geometry, and
// computed-style snapshots of key sections at desktop + mobile widths.

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const LIVE = process.env.LIVE_URL ?? "https://www.x29.ai/";
const LOCAL = process.env.LOCAL_URL ?? "http://localhost:3000/";
const OUT = path.resolve(
  process.cwd(),
  process.env.OUT_DIR ?? "docs/design-references/qa/clone-diff",
);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const SECTIONS = [
  { id: "hero", selector: "section.hero-home-section" },
  { id: "nav", selector: ".master-navigation" },
  { id: "overlap", selector: "section.home-overlap-section" },
  { id: "work", selector: "section.home-work-section" },
  { id: "services", selector: "section.home-services-section" },
  { id: "video", selector: "section.home-video-section" },
  { id: "numbers", selector: "section.home-numbers-section" },
  { id: "footer", selector: ".footer" },
];

const STYLE_KEYS = [
  "display","position","top","right","bottom","left","zIndex","width","height",
  "minWidth","minHeight","maxWidth","maxHeight",
  "padding","paddingTop","paddingRight","paddingBottom","paddingLeft",
  "margin","marginTop","marginRight","marginBottom","marginLeft",
  "fontSize","fontWeight","fontFamily","lineHeight","letterSpacing","color",
  "textAlign","textTransform","textDecoration",
  "backgroundColor","background","borderRadius","border",
  "boxShadow","overflow","overflowX","overflowY",
  "flexDirection","justifyContent","alignItems","gap",
  "gridTemplateColumns","gridTemplateRows",
  "transform","transition","opacity","cursor",
  "objectFit","objectPosition","mixBlendMode","filter","backdropFilter",
];

async function probeSection(page, selector) {
  return page.evaluate(
    ({ selector, keys }) => {
      const el = document.querySelector(selector);
      if (!el) return { selector, present: false };
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const styles = {};
      for (const k of keys) styles[k] = cs[k];
      // Pull primary heading + hero-specific bits if any.
      const h1 = el.querySelector("h1, h2, .headline-home-hero h1");
      const heading = h1
        ? {
            text: h1.textContent?.trim().slice(0, 200) ?? null,
            rect: h1.getBoundingClientRect(),
            styles: Object.fromEntries(
              keys.map((k) => [k, getComputedStyle(h1)[k]]),
            ),
          }
        : null;
      const video = el.querySelector("video");
      const videoMeta = video
        ? {
            rect: video.getBoundingClientRect(),
            styles: Object.fromEntries(
              keys.map((k) => [k, getComputedStyle(video)[k]]),
            ),
            src: video.currentSrc || video.src,
            poster: video.poster,
          }
        : null;
      return {
        selector,
        present: true,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        styles,
        heading,
        videoMeta,
      };
    },
    { selector, keys: STYLE_KEYS },
  );
}

async function probePage(label, url, viewport) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {});
  // Best-effort wait for Webflow IX
  await page.waitForFunction(
    () => document.documentElement.className.includes("w-mod-ix3"),
    { timeout: 5000 },
  ).catch(() => {});
  // Pause hero video on first frame for stable capture
  await page
    .evaluate(async () => {
      // Force any element that Webflow's IX3 normally fades-in to be visible
      const css = document.createElement("style");
      css.textContent = `
        html.w-mod-ix3 .video-home-hero,
        html.w-mod-ix3 .x29-home-hero-media,
        html.w-mod-ix3 .x29-home-hero-stack,
        html.w-mod-ix3 .video-home-hero video,
        html.w-mod-ix3 #x29-home-hero-video,
        html.w-mod-ix3 .nav-wrap-animation,
        html.w-mod-ix3 .headline-home-hero,
        html.w-mod-ix3 .marquee-text,
        html.w-mod-ix3 .marquee-images,
        html.w-mod-ix3 [text="reveal"],
        html.w-mod-ix3 [animate="opacity"],
        html.w-mod-ix3 [text-left],
        html.w-mod-ix3 [text-right] {
          visibility: visible !important;
          opacity: 1 !important;
          transform: none !important;
          translate: none !important;
        }
      `;
      document.head.appendChild(css);
      const sel =
        ".video-home-hero video, #x29-home-hero-video";
      const v = document.querySelector(sel);
      if (v instanceof HTMLVideoElement) {
        try {
          v.pause();
          v.currentTime = 0.5;
          v.removeAttribute("autoplay");
          v.autoplay = false;
        } catch {}
        // Re-pause if the override script tries to play
        const stop = () => {
          try {
            v.pause();
          } catch {}
        };
        v.addEventListener("play", stop);
        v.addEventListener("playing", stop);
      }
    })
    .catch(() => {});
  await page.waitForTimeout(1500);

  await mkdir(OUT, { recursive: true });
  const shotPath = path.join(OUT, `${label}-${viewport.name}-fullpage.png`);
  await page.screenshot({ path: shotPath, fullPage: true });

  const heroShot = path.join(OUT, `${label}-${viewport.name}-hero.png`);
  await page
    .locator("section.hero-home-section")
    .screenshot({ path: heroShot })
    .catch(() => {});

  const data = {};
  for (const s of SECTIONS) data[s.id] = await probeSection(page, s.selector);

  // Page-level body classes / ix3 readiness
  const bodyClass = await page.evaluate(
    () => document.documentElement.className,
  );

  await ctx.close();
  await browser.close();

  return {
    label,
    url,
    viewport: viewport.name,
    bodyClass,
    sections: data,
    screenshot: shotPath,
    heroScreenshot: heroShot,
  };
}

const results = [];
for (const v of VIEWPORTS) {
  results.push(await probePage("live", LIVE, v));
  results.push(await probePage("local", LOCAL, v));
}

const reportPath = path.join(OUT, "report.json");
await writeFile(reportPath, JSON.stringify(results, null, 2));

const summary = [];
summary.push(`# Clone diff report\n`);
summary.push(`live: ${LIVE}`);
summary.push(`local: ${LOCAL}`);
for (const v of VIEWPORTS) {
  const live = results.find(
    (r) => r.label === "live" && r.viewport === v.name,
  );
  const local = results.find(
    (r) => r.label === "local" && r.viewport === v.name,
  );
  summary.push(`\n## viewport: ${v.name} (${v.width}x${v.height})`);
  for (const s of SECTIONS) {
    const a = live?.sections?.[s.id];
    const b = local?.sections?.[s.id];
    if (!a?.present || !b?.present) {
      summary.push(`- ${s.id}: presence live=${a?.present} local=${b?.present}`);
      continue;
    }
    const dx = (b.rect.x - a.rect.x).toFixed(1);
    const dy = (b.rect.y - a.rect.y).toFixed(1);
    const dw = (b.rect.width - a.rect.width).toFixed(1);
    const dh = (b.rect.height - a.rect.height).toFixed(1);
    const styleDiffs = [];
    for (const k of STYLE_KEYS) {
      if (a.styles[k] !== b.styles[k]) {
        styleDiffs.push(`${k}: ${a.styles[k]}  →  ${b.styles[k]}`);
      }
    }
    summary.push(
      `- ${s.id}: Δrect (x${dx}, y${dy}, w${dw}, h${dh})  styleΔ=${styleDiffs.length}`,
    );
    if (styleDiffs.length) {
      for (const line of styleDiffs.slice(0, 8))
        summary.push(`    · ${line}`);
      if (styleDiffs.length > 8)
        summary.push(`    · …and ${styleDiffs.length - 8} more`);
    }
    if (a.heading && b.heading) {
      if (a.heading.text !== b.heading.text) {
        summary.push(
          `    · heading text: "${a.heading.text}"  →  "${b.heading.text}"`,
        );
      }
      const hdx = (b.heading.rect.x - a.heading.rect.x).toFixed(1);
      const hdy = (b.heading.rect.y - a.heading.rect.y).toFixed(1);
      const hdw = (b.heading.rect.width - a.heading.rect.width).toFixed(1);
      summary.push(
        `    · heading rect Δ (x${hdx}, y${hdy}, w${hdw}); fontSize ${a.heading.styles.fontSize} → ${b.heading.styles.fontSize}; textAlign ${a.heading.styles.textAlign} → ${b.heading.styles.textAlign}`,
      );
    }
    if (a.videoMeta && b.videoMeta) {
      const vdx = (b.videoMeta.rect.x - a.videoMeta.rect.x).toFixed(1);
      const vdy = (b.videoMeta.rect.y - a.videoMeta.rect.y).toFixed(1);
      const vdw = (b.videoMeta.rect.width - a.videoMeta.rect.width).toFixed(1);
      const vdh = (b.videoMeta.rect.height - a.videoMeta.rect.height).toFixed(1);
      summary.push(
        `    · video rect Δ (x${vdx}, y${vdy}, w${vdw}, h${vdh}); objectFit ${a.videoMeta.styles.objectFit} → ${b.videoMeta.styles.objectFit}`,
      );
    }
  }
}

const summaryPath = path.join(OUT, "report.md");
await writeFile(summaryPath, summary.join("\n"));
console.log(summaryPath);
console.log(reportPath);
