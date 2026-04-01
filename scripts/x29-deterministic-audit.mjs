import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { chromium } from "playwright-core";

const numeric = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const args = new Map(
  process.argv.slice(2).map((entry) => {
    const [key, ...rest] = entry.split("=");
    return [key, rest.join("=")];
  }),
);

const config = {
  liveUrl: args.get("--live-url") ?? "https://www.x29.ai/",
  localUrl: args.get("--local-url") ?? "http://127.0.0.1:3011/",
  viewportName: args.get("--viewport-name") ?? "desktop",
  viewportWidth: numeric(args.get("--viewport-width"), 1440),
  viewportHeight: numeric(args.get("--viewport-height"), 900),
  heroTime: Math.max(0, numeric(args.get("--hero-time"), 1)),
  footerTime: Math.max(0, numeric(args.get("--footer-time"), 1)),
  sliderIndex: Math.max(0, Math.floor(numeric(args.get("--slider-index"), 0))),
  readyTimeoutMs: Math.max(0, numeric(args.get("--ready-timeout-ms"), 0)),
  holdMs: Math.max(200, numeric(args.get("--hold-ms"), 1200)),
  outDir: path.resolve(
    args.get("--out-dir") ??
      path.join("docs", "design-references", "qa", "deterministic"),
  ),
};

const sections = [
  {
    name: "nav",
    selector: ".nav-wrap-animation",
    freeze: { hero: true, footer: false, slider: false },
    capture: "direct",
  },
  {
    name: "hero",
    selector: "section.hero-home-section",
    freeze: { hero: true, footer: false, slider: false },
    capture: "direct",
  },
  {
    name: "overlap",
    selector: "section.home-overlap-section",
    freeze: { hero: false, footer: false, slider: true, overlapText: true },
    capture: "direct",
  },
  {
    name: "work",
    selector: "section.home-work-section",
    freeze: { hero: false, footer: false, slider: false, marquee: true },
  },
  {
    name: "services",
    selector: "section.home-services-section",
    freeze: { hero: false, footer: false, slider: false },
  },
  {
    name: "video",
    selector: "section.home-video-section",
    freeze: { hero: false, footer: false, slider: false },
  },
  {
    name: "numbers",
    selector: "section.home-numbers-section",
    freeze: { hero: false, footer: false, slider: false },
  },
  {
    name: "journal",
    selector: "section.home-slider-section",
    freeze: { hero: false, footer: false, slider: false },
  },
  {
    name: "footer",
    selector: "section.footer",
    freeze: { hero: false, footer: true, slider: false },
    capture: "direct",
  },
];

const viewportDir = path.join(config.outDir, config.viewportName);
const liveDir = path.join(viewportDir, "live");
const localDir = path.join(viewportDir, "local");
const diffDir = path.join(viewportDir, "diff");

const ensureCleanDir = (targetDir) => {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
};

const waitForAnimationFrames = async (page, count = 2) => {
  await page.evaluate(async (frameCount) => {
    for (let index = 0; index < frameCount; index += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
  }, count);
};

const freezePage = async (
  page,
  freezeConfig,
  targets = {
    hero: true,
    footer: true,
    slider: true,
    marquee: false,
    overlapText: false,
  },
) => {
  return await page.evaluate(async ({ runtimeConfig, targets }) => {
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
        duration === null
          ? targetTime
          : clamp(targetTime, 0, Math.max(duration - 0.05, 0));

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

      const slides = [...mask.children].filter((child) =>
        child.classList.contains("w-slide"),
      );

      if (slides.length === 0) {
        return false;
      }

      const slideIndex = clamp(targetIndex, 0, slides.length - 1);
      const jq = window.jQuery;
      const data =
        jq && slider ? jq.data(slider, ".w-slider") : null;
      const canDriveData =
        data &&
        Array.isArray(data.anchors) &&
        data.anchors.length > slideIndex &&
        data.slides &&
        typeof data.slides.each === "function";

      mask.style.transition = "none";
      mask.style.transform = "none";
      mask.setAttribute("data-qa-frozen", "1");
      slider.setAttribute("data-autoplay", "false");
      slider.setAttribute("data-qa-frozen", "1");

      if (canDriveData) {
        window.clearTimeout(data.timerId);
        data.timerId = null;
        data.hasTimer = false;

        if (data.config) {
          data.config.autoplay = false;
        }

        const offsetX = -data.anchors[slideIndex].x;
        data.index = slideIndex;
        data.previous = slideIndex;
        data.offsetX = offsetX;

        data.slides.each((index, element) => {
          const isActive = index === slideIndex;
          element.style.transform = "translate3d(" + offsetX + "px, 0px, 0px)";
          element.style.transition = "none";
          element.style.visibility = "";
          element.setAttribute("aria-hidden", isActive ? "false" : "true");
          element.classList.toggle("w-active", isActive);
        });

        return true;
      }

      const activeSlide = slides[slideIndex];
      const rect = activeSlide.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        return false;
      }

      mask.style.transform = "translateX(" + -activeSlide.offsetLeft + "px)";

      slides.forEach((slide, index) => {
        const isActive = index === slideIndex;
        slide.style.transition = "none";
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        slide.classList.toggle("w-active", isActive);
      });

      return true;
    };

    const syncMarquees = () => {
      const selectors = [
        ".text-track-about",
        ".marquee-text.left",
        ".marquee-text.right",
        ".marquee-images",
      ];
      let count = 0;

      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => {
          element.style.transition = "none";
          element.style.animation = "none";
          element.style.transform = "translate3d(0px, 0px, 0px)";
          element.setAttribute("data-qa-frozen", "1");
          count += 1;
        });
      });

      return count > 0;
    };

    const syncOverlapText = () => {
      const element = document.querySelector('.wrap-home-about [animate="opacity"]');

      if (!(element instanceof HTMLElement)) {
        return false;
      }

      element.style.transition = "none";
      element.style.opacity = "1";
      element.style.transform = "none";
      element.setAttribute("data-qa-frozen", "1");

      return true;
    };

    const syncState = async () => {
      const runtimeReady = document.documentElement.className.includes("w-mod-ix3");
      const [heroReady, footerReady] = await Promise.all([
        targets.hero
          ? syncVideo(".video-home-hero video", runtimeConfig.heroTime)
          : true,
        targets.footer
          ? syncVideo(".video-footer video", runtimeConfig.footerTime)
          : true,
      ]);
      const sliderReady = targets.slider
        ? syncSlider(".slider-images", runtimeConfig.sliderIndex)
        : true;
      const marqueeReady = targets.marquee ? syncMarquees() : true;
      const overlapTextReady = targets.overlapText ? syncOverlapText() : true;

      return {
        ready:
          runtimeReady &&
          heroReady &&
          footerReady &&
          sliderReady &&
          marqueeReady &&
          overlapTextReady,
        runtimeReady,
        heroReady,
        footerReady,
        sliderReady,
        marqueeReady,
        overlapTextReady,
      };
    };

    if (document.fonts?.ready) {
      await Promise.race([document.fonts.ready, wait(4000)]);
    }

    if (runtimeConfig.readyTimeoutMs > 0) {
      await wait(runtimeConfig.readyTimeoutMs);
    }

    const start = window.performance.now();
    let status = await syncState();

    while (!status.ready && window.performance.now() - start < 12000) {
      await wait(100);
      status = await syncState();
    }

    const deadline = window.performance.now() + runtimeConfig.holdMs;

    while (window.performance.now() < deadline) {
      await syncState();
      await raf();
    }

    document.documentElement.setAttribute("data-qa-frozen", status.ready ? "1" : "0");

    return status;
  }, { runtimeConfig: freezeConfig, targets });
};

const getImageSize = (targetPath) => {
  const result = spawnSync(
    "magick",
    ["identify", "-format", "%w %h", targetPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Image size lookup failed");
  }

  const [width, height] = result.stdout.trim().split(/\s+/).map(Number);
  return { width, height };
};

const compareImages = (livePath, localPath, diffPath) => {
  const liveSize = getImageSize(livePath);
  const localSize = getImageSize(localPath);

  if (
    liveSize.width !== localSize.width ||
    liveSize.height !== localSize.height
  ) {
    return {
      sameSize: false,
      liveSize,
      localSize,
      aeDiff: null,
    };
  }

  const result = spawnSync(
    "magick",
    ["compare", "-metric", "AE", livePath, localPath, diffPath],
    { encoding: "utf8" },
  );
  const metricText = (result.stderr || result.stdout || "").trim();
  const metricMatch = metricText.match(/^\s*([0-9.+\-eE]+)/);
  const metricValue = metricMatch ? Number(metricMatch[1]) : null;

  return {
    sameSize: true,
    liveSize,
    localSize,
    aeDiff: Number.isFinite(metricValue) ? metricValue : null,
  };
};

const cropImage = (sourcePath, targetPath, box) => {
  const cropGeometry = `${Math.ceil(box.width)}x${Math.ceil(box.height)}+${Math.max(
    0,
    Math.floor(box.x),
  )}+${Math.max(0, Math.floor(box.y))}`;
  const result = spawnSync(
    "magick",
    [sourcePath, "-crop", cropGeometry, "+repage", targetPath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Crop failed");
  }
};

const capturePageSet = async (page, label, targetDir) => {
  console.log("Opening", label);
  await page.goto(label === "local" ? config.localUrl : config.liveUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  console.log("Freezing", label);
  await freezePage(page, config, {
    hero: true,
    footer: true,
    slider: true,
    marquee: true,
  });

  await waitForAnimationFrames(page);
  console.log("Measuring", label);

  const sectionBoxes = await page.evaluate((entries) => {
    return entries.map((entry) => {
      const element = document.querySelector(entry.selector);

      if (!(element instanceof HTMLElement)) {
        return {
          name: entry.name,
          selector: entry.selector,
          missing: true,
        };
      }

      const rect = element.getBoundingClientRect();

      return {
        name: entry.name,
        selector: entry.selector,
        missing: false,
        box: {
          x: rect.x + window.scrollX,
          y: rect.y + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
      };
    });
  }, sections.map(({ name, selector }) => ({ name, selector })));

  const metaPath = path.join(targetDir, "__meta.json");
  const fullPath = path.join(targetDir, "__full.png");

  console.log("Screenshotting", label);
  await page.screenshot({
    path: fullPath,
    fullPage: true,
    scale: "css",
    animations: "disabled",
  });

  console.log("Writing meta", label);
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(metaPath, JSON.stringify(sectionBoxes, null, 2) + "\n", "utf8"),
  );

  for (const section of sections.filter((entry) => entry.capture)) {
    console.log("Direct capture", label, section.name);
    const locator = page.locator(section.selector).first();

    if ((await locator.count()) === 0) {
      continue;
    }

    await locator.scrollIntoViewIfNeeded();
    await waitForAnimationFrames(page);
    await freezePage(page, config, section.freeze);
    await waitForAnimationFrames(page);

    const box = await locator.boundingBox();

    if (!box) {
      continue;
    }

    if (section.capture === "element") {
      await locator.screenshot({
        path: path.join(targetDir, section.name + ".png"),
        scale: "css",
        animations: "disabled",
      });
    } else {
      await page.screenshot({
        path: path.join(targetDir, section.name + ".png"),
        clip: {
          x: Math.max(0, Math.floor(box.x)),
          y: Math.max(0, Math.floor(box.y)),
          width: Math.ceil(box.width),
          height: Math.ceil(box.height),
        },
        scale: "css",
        animations: "disabled",
      });
    }
  }

  return {
    fullPath,
    sections: sectionBoxes,
  };
};

ensureCleanDir(viewportDir);
mkdirSync(liveDir, { recursive: true });
mkdirSync(localDir, { recursive: true });
mkdirSync(diffDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromium.executablePath(),
  headless: true,
});

const context = await browser.newContext({
  viewport: {
    width: config.viewportWidth,
    height: config.viewportHeight,
  },
  deviceScaleFactor: 1,
});

const livePage = await context.newPage();
const localPage = await context.newPage();

console.log("Capturing live");
const liveSections = await capturePageSet(livePage, "live", liveDir);
console.log("Capturing local");
const localSections = await capturePageSet(localPage, "local", localDir);

const report = {
  viewport: {
    name: config.viewportName,
    width: config.viewportWidth,
    height: config.viewportHeight,
  },
  config,
  sections: [],
};

for (const section of sections) {
  console.log("Cropping", section.name);
  const liveMeta = liveSections.sections.find((entry) => entry.name === section.name);
  const localMeta = localSections.sections.find((entry) => entry.name === section.name);
  const livePath = path.join(liveDir, section.name + ".png");
  const localPath = path.join(localDir, section.name + ".png");
  const diffPath = path.join(diffDir, section.name + ".png");

  if (liveMeta?.missing || localMeta?.missing) {
    report.sections.push({
      name: section.name,
      selector: section.selector,
      missing: {
        live: Boolean(liveMeta?.missing),
        local: Boolean(localMeta?.missing),
      },
    });
    continue;
  }

  if (section.capture !== "direct" && section.capture !== "element") {
    cropImage(liveSections.fullPath, livePath, liveMeta.box);
    cropImage(localSections.fullPath, localPath, localMeta.box);
  }

  const comparison = compareImages(livePath, localPath, diffPath);

  report.sections.push({
    name: section.name,
    selector: section.selector,
    liveBox: liveMeta?.box ?? null,
    localBox: localMeta?.box ?? null,
    ...comparison,
  });
}

await browser.close();

const reportPath = path.join(viewportDir, "report.json");
await import("node:fs/promises").then(({ writeFile }) =>
  writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8"),
);

console.log(JSON.stringify(report, null, 2));
