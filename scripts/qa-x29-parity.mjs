import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import { chromium } from "playwright-core";

const execFile = promisify(execFileCallback);

const chromePath =
  process.env.X29_CHROME_PATH ?? "/usr/bin/google-chrome-stable";
const liveUrl = process.env.X29_LIVE_URL ?? "https://www.x29.ai/";
const localUrlBase = process.env.X29_LOCAL_URL ?? "http://127.0.0.1:3011/";
const outputRoot = path.resolve(
  process.cwd(),
  process.env.X29_QA_OUTPUT_DIR ??
    "docs/design-references/qa/deterministic",
);
const captureFullPage = process.env.X29_QA_CAPTURE_FULL === "1";
const hiddenSelectors = (process.env.X29_QA_HIDE_SELECTORS ?? "")
  .split(",")
  .map((selector) => selector.trim())
  .filter(Boolean);
const syncLiveDynamicState = process.env.X29_QA_SYNC_LIVE === "1";

const freezeConfig = {
  sliderIndex: Number.parseInt(process.env.X29_QA_SLIDER_INDEX ?? "0", 10),
  heroTime: Number.parseFloat(process.env.X29_QA_HERO_TIME ?? "0.1"),
  footerTime: Number.parseFloat(process.env.X29_QA_FOOTER_TIME ?? "0.1"),
  readyTimeoutMs: Number.parseInt(process.env.X29_QA_READY_TIMEOUT_MS ?? "7000", 10),
  holdWindowMs: Number.parseInt(process.env.X29_QA_HOLD_WINDOW_MS ?? "1500", 10),
  normalizeScrollState: process.env.X29_QA_NORMALIZE_SCROLL === "1",
};

const hideFixedOverlay = process.env.X29_QA_HIDE_FIXED !== "0";

const viewportMap = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

const requestedViewports = (process.env.X29_QA_VIEWPORTS ??
  "desktop,tablet,mobile")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const viewports = requestedViewports.map((name) => {
  const viewport = viewportMap[name];

  if (!viewport) {
    throw new Error(`Unknown viewport "${name}"`);
  }

  return { name, ...viewport };
});

const allSections = [
  { id: "top", type: "top-to-selector", selector: "section.hero-home-section" },
  { id: "overlap-copy", type: "element", selector: ".wrap-home-about" },
  {
    id: "overlap-copy-text",
    type: "element",
    selector: ".wrap-home-about h2.no-margins",
  },
  { id: "overlap-slider", type: "element", selector: ".home-overlap-section .mask-images" },
  {
    id: "overlap-active",
    type: "element",
    selector: ".home-overlap-section .slide-images.w-active .image-wrap-circle",
  },
  { id: "work-intro", type: "element", selector: ".home-work-section .home-about-halves" },
  {
    id: "work-marquee",
    type: "element",
    selector: ".home-work-section .master-blured-marquee",
  },
  {
    id: "work-marquee-track",
    type: "element",
    selector: ".home-work-section .marquee",
  },
  {
    id: "work-marquee-text",
    type: "element",
    selector: ".home-work-section .marquee-text.left",
  },
  {
    id: "work-marquee-blur",
    type: "element",
    selector: ".home-work-section .overlay-marquee-blur",
  },
  { id: "work-projects", type: "element", selector: ".home-work-section .projects" },
  {
    id: "work-project-card-1",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(1) .card-project",
  },
  {
    id: "work-project-card-1-image",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(1) .image-wrap-project",
  },
  {
    id: "work-project-card-1-copy",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(1) .text-wrap-project-card",
  },
  {
    id: "work-project-card-2",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(2) .card-project",
  },
  {
    id: "work-project-card-2-image",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(2) .image-wrap-project",
  },
  {
    id: "work-project-card-2-copy",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(2) .text-wrap-project-card",
  },
  {
    id: "work-project-card-3",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(3) .card-project",
  },
  {
    id: "work-project-card-3-image",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(3) .image-wrap-project",
  },
  {
    id: "work-project-card-3-copy",
    type: "element",
    selector: ".home-work-section .project-item:nth-of-type(3) .text-wrap-project-card",
  },
  {
    id: "work-cta",
    type: "element",
    selector: ".home-work-section .button-wrap-home-work",
  },
  {
    id: "work-dots",
    type: "element",
    selector: ".home-work-section .marquee-dots",
  },
  { id: "work", type: "element", selector: "section.home-work-section" },
  { id: "services", type: "element", selector: "section.home-services-section" },
  {
    id: "video-heading",
    type: "element",
    selector: ".home-video-section .text-wrap-home-story",
  },
  {
    id: "video-copy",
    type: "element",
    selector: ".home-video-section .content-home-story",
  },
  {
    id: "video-cta",
    type: "element",
    selector: ".home-video-section .cta-small",
  },
  {
    id: "video-overlay-top",
    type: "element",
    selector: ".home-video-section .overlay-home-story:not(.bottom)",
  },
  {
    id: "video-overlay-bottom",
    type: "element",
    selector: ".home-video-section .overlay-home-story.bottom",
  },
  {
    id: "video-content",
    type: "element",
    selector: ".home-video-section .master-home-story",
  },
  { id: "video", type: "element", selector: "section.home-video-section" },
  { id: "numbers", type: "element", selector: "section.home-numbers-section" },
  { id: "journal", type: "element", selector: "section.home-slider-section" },
  { id: "footer", type: "element", selector: "section.footer" },
];

const requestedSectionIds = (process.env.X29_QA_SECTIONS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const sections =
  requestedSectionIds.length === 0
    ? allSections
    : requestedSectionIds.map((sectionId) => {
        const section = allSections.find((entry) => entry.id === sectionId);

        if (!section) {
          throw new Error(`Unknown section "${sectionId}"`);
        }

        return section;
      });

function buildLocalUrl() {
  const url = new URL(localUrlBase);

  if (process.env.X29_QA_USE_LOCAL_SCRIPT === "1") {
    url.searchParams.set("qa", "1");
    url.searchParams.set("qaSliderIndex", String(freezeConfig.sliderIndex));
    url.searchParams.set("qaHeroTime", String(freezeConfig.heroTime));
    url.searchParams.set("qaFooterTime", String(freezeConfig.footerTime));
    url.searchParams.set("qaHoldMs", String(freezeConfig.holdWindowMs));
  }

  return url.toString();
}

async function ensureDir(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function setHiddenSelectors(page) {
  if (hiddenSelectors.length === 0) {
    return;
  }

  await page.evaluate((selectors) => {
    let hiddenStyle = document.getElementById("x29-qa-hidden-style");

    if (!(hiddenStyle instanceof HTMLStyleElement)) {
      hiddenStyle = document.createElement("style");
      hiddenStyle.id = "x29-qa-hidden-style";
      document.head.appendChild(hiddenStyle);
    }

    hiddenStyle.textContent = `
      ${selectors.join(", ")} {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
  }, hiddenSelectors);
}

async function identifyPixels(filePath) {
  const { stdout } = await execFile(
    "magick",
    ["identify", "-format", "%w %h", filePath],
    { encoding: "utf8" },
  );
  const [width, height] = stdout.trim().split(/\s+/).map(Number);

  return { width, height, pixels: width * height };
}

async function compareImages(referencePath, localPath, diffPath) {
  const parseMetric = (rawValue) => {
    const match = rawValue.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : Number.NaN;
  };

  try {
    const { stderr } = await execFile(
      "magick",
      ["compare", "-metric", "AE", referencePath, localPath, diffPath],
      { encoding: "utf8" },
    );
    return parseMetric(stderr || "0");
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "stderr" in error &&
      typeof error.stderr === "string"
    ) {
      const value = parseMetric(error.stderr);

      if (Number.isFinite(value)) {
        return value;
      }
    }

    throw error;
  }
}

async function captureDynamicStateForSection(page, section) {
  if (section.id.startsWith("work")) {
    return page.evaluate(() => ({
      groups: [
        {
          selector: ".home-work-section",
          entries: [...document.querySelectorAll(".home-work-section")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  backgroundColor: styles.backgroundColor,
                  color: styles.color,
                },
              };
            }),
        },
        {
          selector: ".section.home-overlap-section",
          entries: [...document.querySelectorAll(".section.home-overlap-section")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  backgroundColor: styles.backgroundColor,
                  color: styles.color,
                },
              };
            }),
        },
        {
          selector: ".section.home-services-section",
          entries: [...document.querySelectorAll(".section.home-services-section")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  backgroundColor: styles.backgroundColor,
                  color: styles.color,
                },
              };
            }),
        },
        {
          selector: ".home-work-section .marquee",
          entries: [...document.querySelectorAll(".home-work-section .marquee")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  transform: styles.transform,
                  opacity: styles.opacity,
                },
              };
            }),
        },
        {
          selector: ".home-work-section .marquee-text.left",
          entries: [...document.querySelectorAll(".home-work-section .marquee-text.left")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  transform: styles.transform,
                  opacity: styles.opacity,
                },
              };
            }),
        },
        {
          selector: ".home-work-section .overlay-marquee-blur",
          entries: [...document.querySelectorAll(".home-work-section .overlay-marquee-blur")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  opacity: styles.opacity,
                },
              };
            }),
        },
        {
          selector: ".home-work-section .marquee-dots",
          entries: [...document.querySelectorAll(".home-work-section .marquee-dots")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  transform: styles.transform,
                  opacity: styles.opacity,
                },
              };
            }),
        },
      ],
    }));
  }

  if (section.id.startsWith("video")) {
    return page.evaluate(() => ({
      groups: [
        {
          selector: ".home-video-section .gsap_split_letter",
          entries: [...document.querySelectorAll(".home-video-section .gsap_split_letter")]
            .filter((element) => element instanceof HTMLElement)
            .map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  transform: styles.transform,
                  opacity: styles.opacity,
                },
              };
            }),
        },
      ],
    }));
  }

  if (section.id.startsWith("overlap")) {
    return page.evaluate(() => {
      const mask = document.querySelector(".home-overlap-section .w-slider-mask");
      const slides = [...document.querySelectorAll(".home-overlap-section .slide-images")]
        .filter((element) => element instanceof HTMLElement);

      return {
        groups: [
          {
            selector: ".home-overlap-section .w-slider-mask",
            entries:
              mask instanceof HTMLElement
                ? [
                    {
                      styles: {
                        transform: getComputedStyle(mask).transform,
                      },
                    },
                  ]
                : [],
          },
          {
            selector: ".home-overlap-section .slide-images",
            entries: slides.map((element) => {
              const styles = getComputedStyle(element);

              return {
                styles: {
                  transform: styles.transform,
                  opacity: styles.opacity,
                  filter: styles.filter,
                  visibility: styles.visibility,
                },
                attributes: {
                  "aria-hidden": element.getAttribute("aria-hidden") ?? "",
                },
                state: {
                  isActive: element.classList.contains("w-active"),
                },
              };
            }),
          },
        ],
      };
    });
  }

  return null;
}

async function applyDynamicState(page, dynamicState) {
  if (!dynamicState) {
    return;
  }

  await page.evaluate((state) => {
    state.groups.forEach((group) => {
      const elements = [...document.querySelectorAll(group.selector)];

      elements.forEach((element, index) => {
        if (!(element instanceof HTMLElement)) {
          return;
        }

        const entry = group.entries[index];

        if (!entry) {
          return;
        }

        if (entry.styles) {
          Object.entries(entry.styles).forEach(([property, value]) => {
            element.style.setProperty(property, value, "important");
          });
        }

        if (entry.attributes) {
          Object.entries(entry.attributes).forEach(([name, value]) => {
            element.setAttribute(name, value);
          });
        }

        if (entry.state?.isActive !== undefined) {
          element.classList.toggle("w-active", Boolean(entry.state.isActive));
        }
      });
    });
  }, dynamicState);
}

async function gotoPage(page, url, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await page.evaluate(async () => {
    if ("fonts" in document) {
      await document.fonts.ready;
    }
  });
}

async function freezePage(page, options = {}) {
  const config = {
    ...freezeConfig,
    lockMotion: options.lockMotion ?? false,
  };

  return page.evaluate(async (configValue) => {
    let qaStyle = document.getElementById("x29-qa-style");

    if (!(qaStyle instanceof HTMLStyleElement)) {
      qaStyle = document.createElement("style");
      qaStyle.id = "x29-qa-style";
      qaStyle.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(qaStyle);
    }

    const normalizeScrollDrivenState = () => {
      document
        .querySelectorAll(".home-work-section .marquee-text.left")
        .forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.transform = "translateX(0px)";
            element.style.willChange = "auto";
          }
        });

      document
        .querySelectorAll(".home-video-section .gsap_split_letter")
        .forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.transform = "translate3d(0px, 0px, 0px)";
            element.style.opacity = "1";
            element.style.willChange = "auto";
          }
        });
    };

    const normalizeOverlapState = () => {
      document
        .querySelectorAll('.wrap-home-about [animate="opacity"]')
        .forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.transform = "none";
            element.style.opacity = "1";
            element.style.willChange = "auto";
          }
        });
    };

    const freezeMotion = () => {
      if (configValue.lockMotion) {
        if (window.gsap?.globalTimeline?.pause) {
          window.gsap.globalTimeline.pause();
        }

        if (window.ScrollTrigger?.getAll) {
          window.ScrollTrigger.getAll().forEach((trigger) => {
            if (typeof trigger.disable === "function") {
              trigger.disable(false, true);
            }
          });
        }
      }
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const deadline = window.performance.now() + configValue.readyTimeoutMs;
    let holdDeadline = 0;

    const freezeVideo = (selector, targetTime) => {
      const video = document.querySelector(selector);

        if (!(video instanceof HTMLVideoElement)) {
          return false;
        }

      const duration =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : null;
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

      return Number.isFinite(video.readyState) && video.readyState >= 1;
    };

    const freezeSlider = (selector, targetIndex) => {
      const slider = document.querySelector(selector);
      const mask = slider?.querySelector(".w-slider-mask");

      if (!slider || !mask) {
        return false;
      }

      const slides = [...mask.children].filter((element) =>
        element.classList.contains("w-slide"),
      );

      if (slides.length === 0) {
        return false;
      }

      const slideIndex = clamp(targetIndex, 0, slides.length - 1);
      mask.style.transition = "none";
      mask.style.transform = "none";
      mask.setAttribute("data-qa-frozen", "1");
      slider.setAttribute("data-autoplay", "false");
      slider.setAttribute("data-qa-frozen", "1");
      const jq = window.jQuery;
      const data = jq && slider ? jq.data(slider, ".w-slider") : null;
      const canDriveData =
        data &&
        Array.isArray(data.anchors) &&
        data.anchors.length > slideIndex &&
        data.slides &&
        typeof data.slides.each === "function";

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

      if (rect.width === 0) {
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

    return await new Promise((resolve) => {
      const tick = () => {
        const runtimeReady =
          document.documentElement.className.includes("w-mod-ix3");
        const videosReady =
          freezeVideo(".video-home-hero video", configValue.heroTime) &&
          freezeVideo(".video-footer video", configValue.footerTime);
        const sliderReady = freezeSlider(".slider-images", configValue.sliderIndex);
        if (configValue.normalizeScrollState) {
          normalizeScrollDrivenState();
        }
        normalizeOverlapState();
        freezeMotion();

        if (runtimeReady && videosReady && sliderReady) {
          document.documentElement.setAttribute("data-qa-frozen", "1");

          if (holdDeadline === 0) {
            holdDeadline = window.performance.now() + configValue.holdWindowMs;
          }

          if (window.performance.now() < holdDeadline) {
            window.requestAnimationFrame(tick);
            return;
          }

          resolve({
            runtimeReady,
            videosReady,
            sliderReady,
            timedOut: false,
          });
          return;
        }

        if (window.performance.now() >= deadline) {
          resolve({
            runtimeReady,
            videosReady,
            sliderReady,
            timedOut: true,
          });
          return;
        }

        window.setTimeout(tick, 100);
      };

      tick();
    });
  }, config);
}

async function setFixedOverlayVisibility(page, visible) {
  if (!hideFixedOverlay) {
    return;
  }

  await page.evaluate((nextVisible) => {
    let overlayStyle = document.getElementById("x29-qa-fixed-overlay-style");

    if (nextVisible) {
      overlayStyle?.remove();
      return;
    }

    if (!(overlayStyle instanceof HTMLStyleElement)) {
      overlayStyle = document.createElement("style");
      overlayStyle.id = "x29-qa-fixed-overlay-style";
      overlayStyle.textContent = `
        .nav-wrap-animation {
          opacity: 0 !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(overlayStyle);
    }
  }, visible);
}

async function captureTopSection(page, section, outputPath, viewport, options = {}) {
  await setFixedOverlayVisibility(page, true);
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.round(top), behavior: "instant" });
  }, section.selector);
  await page.waitForTimeout(250);
  const refreeze = await freezePage(page, { lockMotion: true });

  if (refreeze.timedOut) {
    throw new Error(`Post-scroll freeze timed out for ${section.id}`);
  }

  const capturedDynamicState = options.captureDynamicState
    ? await captureDynamicStateForSection(page, section)
    : null;

  if (options.dynamicState) {
    await applyDynamicState(page, options.dynamicState);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(undefined)),
          ),
        ),
    );
  }

  const box = await page.locator(section.selector).boundingBox();

  if (!box) {
    throw new Error(`Could not measure ${section.selector}`);
  }

  const clip = {
    x: 0,
    y: 0,
    width: viewport.width,
    height: Math.ceil(box.y + box.height),
  };

  await page.screenshot({
    path: outputPath,
    scale: "css",
    clip,
  });

  return {
    dynamicState: capturedDynamicState,
  };
}

async function captureElementSection(page, section, outputPath, options = {}) {
  const locator = page.locator(section.selector);
  await setFixedOverlayVisibility(page, false);
  await page.evaluate((selector) => {
    const element = document.querySelector(selector);

    if (!element) {
      return;
    }

    const top = element.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.round(top), behavior: "instant" });
  }, section.selector);
  await page.waitForTimeout(250);
  const refreeze = await freezePage(page, { lockMotion: true });

  if (refreeze.timedOut) {
    throw new Error(`Post-scroll freeze timed out for ${section.id}`);
  }

  const capturedDynamicState = options.captureDynamicState
    ? await captureDynamicStateForSection(page, section)
    : null;

  if (options.dynamicState) {
    await applyDynamicState(page, options.dynamicState);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(undefined)),
          ),
        ),
    );
  }

  await locator.screenshot({
    path: outputPath,
    scale: "css",
  });

  return {
    dynamicState: capturedDynamicState,
  };
}

async function captureSections(page, label, viewport, sectionStateMap) {
  const viewportDir = path.join(outputRoot, viewport.name);
  await ensureDir(viewportDir);

  const imagePaths = {};

  if (captureFullPage) {
    const fullPagePath = path.join(viewportDir, `${label}-full.png`);
    await page.screenshot({ path: fullPagePath, scale: "css", fullPage: true });
    imagePaths.full = fullPagePath;
  }

  for (const section of sections) {
    console.log(`[${viewport.name}] capturing ${label}:${section.id}`);
    await freezePage(page);
    const sectionPath = path.join(viewportDir, `${label}-${section.id}.png`);
    const captureOptions = {
      captureDynamicState: label === "reference" && syncLiveDynamicState,
      dynamicState:
        label === "local" && syncLiveDynamicState
          ? sectionStateMap[section.id] ?? null
          : null,
    };
    const result =
      section.type === "top-to-selector"
        ? await captureTopSection(page, section, sectionPath, viewport, captureOptions)
        : await captureElementSection(page, section, sectionPath, captureOptions);

    if (label === "reference" && syncLiveDynamicState && result.dynamicState) {
      sectionStateMap[section.id] = result.dynamicState;
    }

    console.log(`[${viewport.name}] saved ${sectionPath}`);
    imagePaths[section.id] = sectionPath;
  }

  return imagePaths;
}

async function runViewport(browser, viewport) {
  console.log(`[${viewport.name}] opening pages`);
  const liveContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const localContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });

  const livePage = await liveContext.newPage();
  const localPage = await localContext.newPage();

  const localUrl = buildLocalUrl();
  await gotoPage(livePage, liveUrl, viewport);
  await gotoPage(localPage, localUrl, viewport);
  await setHiddenSelectors(livePage);
  await setHiddenSelectors(localPage);

  console.log(`[${viewport.name}] freezing pages`);
  const liveFreeze = await freezePage(livePage);
  const localFreeze = await freezePage(localPage);

  if (liveFreeze.timedOut || localFreeze.timedOut) {
    throw new Error(
      `Freeze timed out for ${viewport.name}: ${JSON.stringify({
        liveFreeze,
        localFreeze,
      })}`,
    );
  }

  const sectionStateMap = {};
  const liveImages = await captureSections(livePage, "reference", viewport, sectionStateMap);
  const localImages = await captureSections(localPage, "local", viewport, sectionStateMap);

  const diffDir = path.join(outputRoot, viewport.name, "diff");
  await ensureDir(diffDir);

  const summary = {};
  const imageIds = Object.keys(liveImages);

  for (const imageId of imageIds) {
    console.log(`[${viewport.name}] diffing ${imageId}`);
    const diffPath = path.join(diffDir, `${imageId}-diff.png`);
    const changedPixels = await compareImages(
      liveImages[imageId],
      localImages[imageId],
      diffPath,
    );
    const { pixels, width, height } = await identifyPixels(liveImages[imageId]);

    summary[imageId] = {
      referencePath: liveImages[imageId],
      localPath: localImages[imageId],
      diffPath,
      width,
      height,
      changedPixels,
      changedPercent: Number(((changedPixels / pixels) * 100).toFixed(4)),
    };
  }

  await liveContext.close();
  await localContext.close();

  return summary;
}

async function main() {
  await ensureDir(outputRoot);

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  const results = {};

  try {
    for (const viewport of viewports) {
      results[viewport.name] = await runViewport(browser, viewport);
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(outputRoot, "summary.json");
  await writeFile(summaryPath, JSON.stringify(results, null, 2) + "\n", "utf8");

  console.log(`Wrote parity summary to ${summaryPath}`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
