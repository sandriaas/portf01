import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const numeric = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  url: process.env.X29_TARGET_URL,
  outputDir: process.env.X29_OUTPUT_DIR,
  viewportWidth: numeric(process.env.X29_VIEWPORT_WIDTH, 1440),
  viewportHeight: numeric(process.env.X29_VIEWPORT_HEIGHT, 900),
  heroTime: Math.max(0, numeric(process.env.X29_HERO_TIME, 0)),
  footerTime: Math.max(0, numeric(process.env.X29_FOOTER_TIME, 0)),
  sliderIndex: Math.max(0, Math.floor(numeric(process.env.X29_SLIDER_INDEX, 0))),
  readyTimeoutMs: Math.max(0, numeric(process.env.X29_READY_TIMEOUT_MS, 0)),
  holdMs: Math.max(200, numeric(process.env.X29_HOLD_MS, 1200)),
  captureFullPage: process.env.X29_CAPTURE_FULL_PAGE === "1",
};

if (!config.url) {
  throw new Error("Missing X29_TARGET_URL");
}

if (!config.outputDir) {
  throw new Error("Missing X29_OUTPUT_DIR");
}

const sections = [
  { name: "nav", selector: ".nav-wrap-animation" },
  { name: "hero", selector: "section.hero-home-section" },
  { name: "overlap", selector: "section.home-overlap-section" },
  { name: "work", selector: "section.home-work-section" },
  { name: "services", selector: "section.home-services-section" },
  { name: "video", selector: "section.home-video-section" },
  { name: "numbers", selector: "section.home-numbers-section" },
  { name: "journal", selector: "section.home-slider-section" },
  { name: "footer", selector: "section.footer" },
];
const sectionFilter = (process.env.X29_SECTION_NAMES ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const sectionsToCapture =
  sectionFilter.length === 0
    ? sections
    : sections.filter((section) => sectionFilter.includes(section.name));

const freezePage = async (page) => {
  return await page.evaluate(async (freezeConfig) => {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const raf = () =>
      new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));

    const syncVideo = async (selector, targetTime) => {
      const video = document.querySelector(selector);

      if (!(video instanceof HTMLVideoElement)) {
        return false;
      }

      if (!(Number.isFinite(video.readyState) && video.readyState >= 1)) {
        await Promise.race([
          new Promise((resolve) => {
            const resolveOnce = () => resolve(undefined);
            video.addEventListener("loadedmetadata", resolveOnce, { once: true });
            video.addEventListener("loadeddata", resolveOnce, { once: true });
          }),
          wait(4000),
        ]);
      }

      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      const nextTime =
        duration === null ? targetTime : clamp(targetTime, 0, Math.max(duration - 0.05, 0));

      try {
        video.currentTime = nextTime;
      } catch {}

      try {
        video.pause();
      } catch {}

      video.autoplay = false;
      video.loop = false;
      video.muted = true;
      video.removeAttribute("autoplay");
      video.removeAttribute("loop");
      video.setAttribute("data-qa-frozen", "1");

      await Promise.race([
        new Promise((resolve) => {
          const resolveOnce = () => {
            try {
              video.pause();
            } catch {}
            resolve(undefined);
          };

          video.addEventListener("seeked", resolveOnce, { once: true });
          video.addEventListener("playing", resolveOnce, { once: true });
        }),
        wait(150),
      ]);

      try {
        video.pause();
      } catch {}

      return true;
    };

    const syncSlider = (selector, targetIndex) => {
      const slider = document.querySelector(selector);
      const mask = slider?.querySelector(".w-slider-mask");

      if (!slider || !mask) {
        return false;
      }

      const slides = [...mask.children].filter((child) => child.classList.contains("w-slide"));

      if (slides.length === 0) {
        return false;
      }

      const slideIndex = clamp(targetIndex, 0, slides.length - 1);
      const activeSlide = slides[slideIndex];
      const rect = activeSlide.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return false;
      }

      mask.style.transition = "none";
      mask.style.transform = `translateX(${-activeSlide.offsetLeft}px)`;
      mask.style.willChange = "auto";
      mask.setAttribute("data-qa-frozen", "1");
      slider.setAttribute("data-autoplay", "false");
      slider.setAttribute("data-qa-frozen", "1");

      slides.forEach((slide, index) => {
        const isActive = index === slideIndex;
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        slide.classList.toggle("w-active", isActive);
      });

      return true;
    };

    const syncState = async () => {
      const runtimeReady = document.documentElement.className.includes("w-mod-ix3");
      const [heroReady, footerReady] = await Promise.all([
        syncVideo(".video-home-hero video", freezeConfig.heroTime),
        syncVideo(".video-footer video", freezeConfig.footerTime),
      ]);
      const sliderReady = syncSlider(".slider-images", freezeConfig.sliderIndex);

      return {
        ready: runtimeReady && heroReady && footerReady && sliderReady,
        runtimeReady,
        heroReady,
        footerReady,
        sliderReady,
      };
    };

    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, wait(4000)]);
    }

    if (freezeConfig.readyTimeoutMs > 0) {
      await wait(freezeConfig.readyTimeoutMs);
    }

    const start = window.performance.now();
    let status = await syncState();

    while (!status.ready && window.performance.now() - start < 12000) {
      await wait(100);
      status = await syncState();
    }

    const deadline = window.performance.now() + freezeConfig.holdMs;

    while (window.performance.now() < deadline) {
      await syncState();
      await raf();
    }

    document.documentElement.setAttribute("data-qa-frozen", status.ready ? "1" : "0");

    return status;
  }, config);
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: {
    width: config.viewportWidth,
    height: config.viewportHeight,
  },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

try {
  await page.goto(config.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(
    () => document.querySelector("section.hero-home-section") !== null,
    undefined,
    { timeout: 15000 },
  );

  const freezeStatus = await freezePage(page);
  fs.mkdirSync(config.outputDir, { recursive: true });

  const snapshot = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    qaFrozen: document.documentElement.getAttribute("data-qa-frozen"),
    sections: [...document.querySelectorAll("section")].length,
  }));
  fs.writeFileSync(
    path.join(config.outputDir, "__meta.json"),
    JSON.stringify({ config, snapshot, freezeStatus }, null, 2),
  );

  if (config.captureFullPage) {
    await page.screenshot({
      path: path.join(config.outputDir, "__full.png"),
      fullPage: true,
      scale: "css",
    });
  }

  const boxes = [];

  for (const section of sectionsToCapture) {
    const locator = page.locator(section.selector).first();

    if ((await locator.count()) === 0) {
      boxes.push({ ...section, missing: true });
      continue;
    }

    await locator.scrollIntoViewIfNeeded();
    await freezePage(page);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          window.requestAnimationFrame(() =>
            window.requestAnimationFrame(() => resolve(undefined)),
          ),
        ),
    );

    const box = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    });

    if (!box) {
      boxes.push({ ...section, missing: true });
      continue;
    }

    await locator.screenshot({
      path: path.join(config.outputDir, `${section.name}.png`),
      scale: "css",
    });

    boxes.push({ ...section, box });
  }

  fs.writeFileSync(
    path.join(config.outputDir, "__boxes.json"),
    JSON.stringify(boxes, null, 2),
  );
  console.log(JSON.stringify({ outputDir: config.outputDir, freezeStatus, boxes }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
