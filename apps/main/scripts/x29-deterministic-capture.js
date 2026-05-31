const fs = require("node:fs");
const path = require("node:path");

const numeric = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const input = state.captureConfig ?? {};
const config = {
  url: input.url,
  outputDir: input.outputDir,
  viewportWidth: numeric(input.viewportWidth, 1440),
  viewportHeight: numeric(input.viewportHeight, 900),
  heroTime: Math.max(0, numeric(input.heroTime, 0)),
  footerTime: Math.max(0, numeric(input.footerTime, 0)),
  sliderIndex: Math.max(0, Math.floor(numeric(input.sliderIndex, 0))),
  readyTimeoutMs: Math.max(0, numeric(input.readyTimeoutMs, 0)),
  holdMs: Math.max(200, numeric(input.holdMs, 1200)),
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

const waitForAnimationFrame = async () => {
  await state.page.evaluate(
    () => new Promise((resolve) => window.requestAnimationFrame(() => resolve())),
  );
};

const ensurePage = async () => {
  if (state.page && !state.page.isClosed()) {
    return state.page;
  }

  state.page =
    context.pages().find((candidate) => candidate.url() === "about:blank") ??
    (await context.newPage());

  return state.page;
};

const freezePage = async () => {
  return await state.page.evaluate(async (freezeConfig) => {
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
      mask.style.transform = "translateX(" + -activeSlide.offsetLeft + "px)";
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

await ensurePage();
await state.page.setViewportSize({
  width: config.viewportWidth,
  height: config.viewportHeight,
});
await state.page.goto(config.url, { waitUntil: "domcontentloaded", timeout: 60000 });
await state.page.waitForLoadState("domcontentloaded");
await state.page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
console.log("URL:", state.page.url());
console.log(
  await snapshot({
    page: state.page,
    search: /Experimental Lab|What we do|Work with us today|Journal/i,
  }),
);

const freezeStatus = await freezePage();
console.log("Freeze status:", JSON.stringify(freezeStatus));

fs.mkdirSync(config.outputDir, { recursive: true });
await state.page.screenshot({
  path: path.join(config.outputDir, "__full.png"),
  fullPage: true,
  scale: "css",
});

for (const section of sections) {
  const locator = state.page.locator(section.selector).first();
  const count = await locator.count();

  if (!count) {
    console.log("Missing section:", section.name, section.selector);
    continue;
  }

  await locator.scrollIntoViewIfNeeded();
  await waitForAnimationFrame();
  await waitForAnimationFrame();

  const box = await locator.boundingBox();

  if (!box) {
    console.log("Section has no box:", section.name, section.selector);
    continue;
  }

  await locator.screenshot({
    path: path.join(config.outputDir, section.name + ".png"),
    scale: "css",
  });

  console.log(
    JSON.stringify({
      name: section.name,
      selector: section.selector,
      box,
    }),
  );
}

state.page.removeAllListeners();
