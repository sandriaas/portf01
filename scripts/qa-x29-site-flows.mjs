import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";

const execFile = promisify(execFileCallback);

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, "src", "content", "x29", "site.json");
const liveOrigin = (process.env.X29_LIVE_ORIGIN ?? "https://www.x29.ai").replace(/\/+$/, "");
const localOrigin = (process.env.X29_LOCAL_ORIGIN ?? "http://127.0.0.1:3012").replace(
  /\/+$/,
  "",
);
const outputDir = path.join(
  rootDir,
  process.env.X29_SITE_FLOW_OUTPUT_DIR ??
    "docs/design-references/qa/runs/site-flow-audit",
);
const requestedViewports = (process.env.X29_SITE_QA_VIEWPORTS ?? "desktop,tablet,mobile")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const skipSliceDiffs = process.env.X29_SITE_QA_SKIP_SLICES === "1";
const readyDelayMs = Number.parseInt(process.env.X29_SITE_QA_READY_DELAY_MS ?? "1400", 10);
const settleDelayMs = Number.parseInt(process.env.X29_SITE_QA_SETTLE_DELAY_MS ?? "450", 10);
const holdWindowMs = Number.parseInt(process.env.X29_SITE_QA_HOLD_WINDOW_MS ?? "1200", 10);
const freezeTimeoutMs = Number.parseInt(
  process.env.X29_SITE_QA_FREEZE_TIMEOUT_MS ?? "12000",
  10,
);
const videoTime = Number.parseFloat(process.env.X29_SITE_QA_VIDEO_TIME ?? "0.1");
const sliderIndex = Number.parseInt(process.env.X29_SITE_QA_SLIDER_INDEX ?? "0", 10);
const stepRatios = (process.env.X29_SITE_QA_STEPS ?? "0,0.25,0.5,0.75,1")
  .split(",")
  .map((value) => Number.parseFloat(value.trim()))
  .filter((value) => Number.isFinite(value))
  .map((value) => Math.max(0, Math.min(1, value)));
const requestedRoutes = new Set(
  (process.env.X29_SITE_QA_ROUTES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeRoute(value)),
);

const viewportMap = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
};

function normalizeRoute(route) {
  if (!route || route === "/") {
    return "/";
  }

  return `/${route.replace(/^\/+|\/+$/g, "")}`;
}

function routeToFileStem(route) {
  if (route === "/") {
    return "home";
  }

  return route
    .replace(/^\/+/, "")
    .replace(/[/?#]+/g, "__")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

function buildUrl(origin, route) {
  return `${origin}${route === "/" ? "" : route}`;
}

function parseTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/is);
  return match ? match[1].trim() : null;
}

function extractLinks(html) {
  return [...html.matchAll(/\b(?:href|action)=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
}

async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "x29-site-flow-audit/2.0",
    },
  });

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    html: await response.text(),
  };
}

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function identifyPixels(filePath) {
  const { stdout } = await execFile("magick", ["identify", "-format", "%w %h", filePath], {
    encoding: "utf8",
  });
  const [width, height] = stdout.trim().split(/\s+/).map(Number);

  return { width, height, pixels: width * height };
}

async function compareImages(referencePath, localPath, diffPath) {
  let metricOutput = "0";

  try {
    const { stderr } = await execFile(
      "magick",
      ["compare", "-metric", "AE", referencePath, localPath, diffPath],
      { encoding: "utf8" },
    );
    metricOutput = stderr.trim() || "0";
  } catch (error) {
    metricOutput = String(error.stderr ?? "").trim() || "0";
  }

  const match =
    metricOutput.match(/([0-9.e+-]+)\s*\(([0-9.e+-]+)\)/) ??
    metricOutput.match(/([0-9.e+-]+)$/);
  const diffPixels = Number.parseFloat(match?.[1] ?? "0");
  const diffRatio = Number.parseFloat(match?.[2] ?? "0");
  const { pixels, width, height } = await identifyPixels(referencePath);

  return {
    width,
    height,
    pixels,
    diffPixels,
    diffRatio,
    diffPercentage: pixels === 0 ? 0 : (diffPixels / pixels) * 100,
  };
}

async function collectPageData(page) {
  return page.evaluate(() => {
    const hrefs = [...document.querySelectorAll("a[href]")].map((element) =>
      element.getAttribute("href"),
    );
    const actions = [...document.querySelectorAll("form[action]")].map((element) =>
      element.getAttribute("action"),
    );

    return {
      title: document.title,
      htmlClass: document.documentElement.className,
      hrefCount: hrefs.length,
      actionCount: actions.length,
      absoluteInternalHrefs: hrefs.filter((href) =>
        /^https?:\/\/(www\.)?x29\.ai/i.test(href ?? ""),
      ),
      protocolRelativeInternalHrefs: hrefs.filter((href) =>
        /^\/\/(www\.)?x29\.ai/i.test(href ?? ""),
      ),
      absoluteInternalActions: actions.filter((action) =>
        /^https?:\/\/(www\.)?x29\.ai/i.test(action ?? ""),
      ),
      protocolRelativeInternalActions: actions.filter((action) =>
        /^\/\/(www\.)?x29\.ai/i.test(action ?? ""),
      ),
    };
  });
}

async function addFreezeStyles(page) {
  await page.addInitScript(() => {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.getElementById("x29-site-flow-freeze")) {
          return;
        }

        const style = document.createElement("style");
        style.id = "x29-site-flow-freeze";
        style.textContent = `
          html {
            scroll-behavior: auto !important;
          }

          *,
          *::before,
          *::after {
            animation: none !important;
            animation-play-state: paused !important;
            transition: none !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
          }
        `;
        document.head.appendChild(style);
      },
      { once: true },
    );
  });
}

async function waitForAnimationFrames(page, count = 2) {
  await page.evaluate(async (frameCount) => {
    for (let frame = 0; frame < frameCount; frame += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    }
  }, count);
}

async function gotoPage(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(readyDelayMs);
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 4_000)),
      ]);
    }
  });
  return response;
}

async function freezePage(page) {
  if (page.isClosed()) {
    return {
      runtimeReady: false,
      videosReady: false,
      slidersReady: false,
      timedOut: true,
    };
  }

  try {
    const freezeStatus = await page.evaluate(
      async ({ holdForMs, timeoutMs, targetTime, targetIndex }) => {
        let style = document.getElementById("x29-site-flow-freeze");

        if (!(style instanceof HTMLStyleElement)) {
          style = document.createElement("style");
          style.id = "x29-site-flow-freeze";
          style.textContent = `
            html {
              scroll-behavior: auto !important;
            }

            *,
            *::before,
            *::after {
              animation: none !important;
              animation-play-state: paused !important;
              transition: none !important;
              transition-duration: 0s !important;
              transition-delay: 0s !important;
            }
          `;
          document.head.appendChild(style);
        }

        const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
        const raf = () =>
          new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        const normalizeMotion = () => {
          if (typeof document.getAnimations === "function") {
            document.getAnimations().forEach((animation) => {
              try {
                animation.pause();
              } catch {}
            });
          }

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
        };

        const normalizeSelectors = (selectors, styles) => {
          let count = 0;

          selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
              if (!(element instanceof HTMLElement)) {
                return;
              }

              Object.entries(styles).forEach(([property, value]) => {
                element.style.setProperty(property, value, "important");
              });
              element.setAttribute("data-qa-frozen", "1");
              count += 1;
            });
          });

          return count > 0;
        };

        const normalizeScrollDrivenState = () => {
          normalizeSelectors(
            [
              ".text-track-about",
              ".marquee-text.left",
              ".marquee-text.right",
              ".marquee-images",
              ".home-work-section .marquee-dots",
            ],
            {
              transition: "none",
              animation: "none",
              transform: "translate3d(0px, 0px, 0px)",
              opacity: "1",
              willChange: "auto",
            },
          );

          normalizeSelectors(
            [".home-video-section .gsap_split_letter", '.wrap-home-about [animate="opacity"]'],
            {
              transition: "none",
              animation: "none",
              transform: "none",
              opacity: "1",
              willChange: "auto",
            },
          );
        };

        const freezeVideo = async (video) => {
          if (!(video instanceof HTMLVideoElement)) {
            return false;
          }

          const posterSource =
            video.getAttribute("poster") ||
            video.poster ||
            video.parentElement?.getAttribute("data-poster-url") ||
            "";
          const posterBackground = video.style.backgroundImage || "";

          if (!(Number.isFinite(video.readyState) && video.readyState >= 1)) {
            await Promise.race([
              new Promise((resolve) => {
                const done = () => resolve(undefined);
                video.addEventListener("loadedmetadata", done, { once: true });
                video.addEventListener("loadeddata", done, { once: true });
              }),
              wait(4_000),
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

          const backgroundHost = video.closest(".w-background-video") ?? video.parentElement;
          const backgroundImage =
            posterBackground ||
            (posterSource ? `url("${posterSource.replace(/"/g, '\\"')}")` : "");

          if (backgroundHost instanceof HTMLElement && backgroundImage) {
            backgroundHost.style.setProperty("background-image", backgroundImage, "important");
            backgroundHost.style.setProperty("background-position", "50% 50%", "important");
            backgroundHost.style.setProperty("background-repeat", "no-repeat", "important");
            backgroundHost.style.setProperty("background-size", "cover", "important");
            video.style.setProperty("opacity", "0", "important");
            video.style.setProperty("visibility", "hidden", "important");
          }

          await Promise.race([
            new Promise((resolve) => {
              const done = () => {
                try {
                  video.pause();
                } catch {}
                resolve(undefined);
              };
              video.addEventListener("seeked", done, { once: true });
              video.addEventListener("playing", done, { once: true });
            }),
            wait(150),
          ]);

          try {
            video.pause();
          } catch {}

          return true;
        };

        const freezeSlider = (slider) => {
          if (!(slider instanceof HTMLElement)) {
            return false;
          }

          const mask = slider.querySelector(".w-slider-mask");

          if (!(mask instanceof HTMLElement)) {
            return false;
          }

          const slides = [...mask.children].filter(
            (element) => element instanceof HTMLElement && element.classList.contains("w-slide"),
          );

          if (slides.length === 0) {
            return false;
          }

          const slideIndex = clamp(targetIndex, 0, slides.length - 1);
          const jq = window.jQuery;
          const data = jq ? jq.data(slider, ".w-slider") : null;
          const canDriveData =
            data &&
            Array.isArray(data.anchors) &&
            data.anchors.length > slideIndex &&
            data.slides &&
            typeof data.slides.each === "function";

          mask.style.setProperty("transition", "none", "important");
          mask.style.setProperty("transform", "none", "important");
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
              element.style.transform = `translate3d(${offsetX}px, 0px, 0px)`;
              element.style.transition = "none";
              element.style.visibility = "";
              element.setAttribute("aria-hidden", isActive ? "false" : "true");
              element.classList.toggle("w-active", isActive);
            });

            return true;
          }

          const activeSlide = slides[slideIndex];

          if (!(activeSlide instanceof HTMLElement)) {
            return false;
          }

          mask.style.setProperty(
            "transform",
            `translateX(${-activeSlide.offsetLeft}px)`,
            "important",
          );

          slides.forEach((slide, index) => {
            const isActive = index === slideIndex;
            slide.style.transition = "none";
            slide.setAttribute("aria-hidden", isActive ? "false" : "true");
            slide.classList.toggle("w-active", isActive);
          });

          return true;
        };

        if (document.fonts?.ready) {
          await Promise.race([document.fonts.ready, wait(4_000)]);
        }

        const deadline = window.performance.now() + timeoutMs;
        let holdDeadline = 0;
        let status = {
          runtimeReady: false,
          videosReady: false,
          slidersReady: false,
          timedOut: false,
        };

        while (window.performance.now() < deadline) {
          normalizeMotion();
          normalizeScrollDrivenState();

          const videos = [...document.querySelectorAll("video")];
          const videoResults = await Promise.all(videos.map((video) => freezeVideo(video)));
          const slidersReady = [...document.querySelectorAll(".w-slider")].every((slider) =>
            freezeSlider(slider),
          );
          const runtimeReady =
            document.documentElement.className.includes("w-mod-ix3") ||
            document.readyState === "complete";
          const videosReady = videoResults.every(Boolean);

          status = {
            runtimeReady,
            videosReady,
            slidersReady,
            timedOut: false,
          };

          if (runtimeReady && videosReady && slidersReady) {
            document.documentElement.setAttribute("data-qa-frozen", "1");

            if (holdDeadline === 0) {
              holdDeadline = window.performance.now() + holdForMs;
            }

            if (window.performance.now() >= holdDeadline) {
              return status;
            }
          }

          await raf();
        }

        document.documentElement.setAttribute("data-qa-frozen", "0");
        return {
          ...status,
          timedOut: true,
        };
      },
      {
        holdForMs: holdWindowMs,
        timeoutMs: freezeTimeoutMs,
        targetTime: videoTime,
        targetIndex: sliderIndex,
      },
    );

    await waitForAnimationFrames(page);
    return freezeStatus;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Target page, context or browser has been closed")) {
      return {
        runtimeReady: false,
        videosReady: false,
        slidersReady: false,
        timedOut: true,
      };
    }

    throw error;
  }
}

async function scrollToRatio(page, ratio) {
  return page.evaluate((nextRatio) => {
    const root = document.scrollingElement ?? document.documentElement;
    const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 0);
    const scrollY = Math.round(maxScroll * nextRatio);
    window.scrollTo(0, scrollY);

    return {
      scrollY,
      scrollHeight: root.scrollHeight,
      viewportHeight: window.innerHeight,
      maxScroll,
    };
  }, ratio);
}

async function captureViewport(page, destinationPath) {
  await page.screenshot({
    path: destinationPath,
    scale: "css",
  });
}

async function compareRouteSlices(browser, route, viewportName, routeDir) {
  const viewport = viewportMap[viewportName];

  if (!viewport) {
    throw new Error(`Unknown viewport "${viewportName}"`);
  }

  const context = await browser.newContext({ viewport });
  const livePage = await context.newPage();
  const localPage = await context.newPage();

  try {
    await Promise.all([addFreezeStyles(livePage), addFreezeStyles(localPage)]);

    const liveUrl = buildUrl(liveOrigin, route);
    const localUrl = buildUrl(localOrigin, route);
    const [liveResponse, localResponse] = await Promise.all([
      gotoPage(livePage, liveUrl),
      gotoPage(localPage, localUrl),
    ]);

    const [livePageData, localPageData] = await Promise.all([
      collectPageData(livePage),
      collectPageData(localPage),
    ]);
    const slices = [];

    let runtimeError = null;

    for (let stepIndex = 0; stepIndex < stepRatios.length; stepIndex += 1) {
      const ratio = stepRatios[stepIndex];
      try {
        const [liveScroll, localScroll] = await Promise.all([
          scrollToRatio(livePage, ratio),
          scrollToRatio(localPage, ratio),
        ]);

        await Promise.all([
          livePage.waitForTimeout(settleDelayMs),
          localPage.waitForTimeout(settleDelayMs),
        ]);
        const [liveFrozen, localFrozen] = await Promise.all([
          freezePage(livePage),
          freezePage(localPage),
        ]);

        if (livePage.isClosed() || localPage.isClosed()) {
          runtimeError = "A page closed during the frozen-frame capture.";
          break;
        }

        if (liveFrozen.timedOut || localFrozen.timedOut) {
          runtimeError = `Freeze timed out (live=${liveFrozen.timedOut}, local=${localFrozen.timedOut})`;
          break;
        }

        await waitForAnimationFrames(livePage);
        await waitForAnimationFrames(localPage);

        const liveSlicePath = path.join(routeDir, `${viewportName}-step-${stepIndex}.live.png`);
        const localSlicePath = path.join(routeDir, `${viewportName}-step-${stepIndex}.local.png`);
        const diffSlicePath = path.join(routeDir, `${viewportName}-step-${stepIndex}.diff.png`);

        await captureViewport(livePage, liveSlicePath);
        await captureViewport(localPage, localSlicePath);

        const diff = await compareImages(liveSlicePath, localSlicePath, diffSlicePath);
        slices.push({
          stepIndex,
          ratio,
          liveScroll,
          localScroll,
          screenshotPaths: {
            live: path.relative(rootDir, liveSlicePath),
            local: path.relative(rootDir, localSlicePath),
            diff: path.relative(rootDir, diffSlicePath),
          },
          diff,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtimeError = message;
        break;
      }
    }

    const diffSummary = slices.reduce(
      (accumulator, entry) => {
        accumulator.maxDiffPercentage = Math.max(
          accumulator.maxDiffPercentage,
          entry.diff.diffPercentage,
        );
        accumulator.totalDiffPercentage += entry.diff.diffPercentage;
        if (entry.diff.diffPercentage === 0) {
          accumulator.zeroDiffSlices += 1;
        }
        return accumulator;
      },
      {
        maxDiffPercentage: 0,
        totalDiffPercentage: 0,
        zeroDiffSlices: 0,
      },
    );
    diffSummary.avgDiffPercentage =
      slices.length === 0 ? 0 : diffSummary.totalDiffPercentage / slices.length;

    return {
      route,
      viewport: viewportName,
      live: {
        status: liveResponse.status ?? null,
        titleBrowser: livePageData.title,
      },
      local: {
        status: localResponse.status ?? null,
        titleBrowser: localPageData.title,
      },
      matches: {
        browserTitle: livePageData.title === localPageData.title,
      },
      linkRewriteClean:
        localPageData.absoluteInternalHrefs.length === 0 &&
        localPageData.protocolRelativeInternalHrefs.length === 0 &&
        localPageData.absoluteInternalActions.length === 0 &&
        localPageData.protocolRelativeInternalActions.length === 0,
      localLinkData: localPageData,
      liveLinkData: livePageData,
      slices,
      diffSummary,
      runtimeError,
    };
  } finally {
    await context.close();
  }
}

async function compareRouteParity(routes, screenshotsDir) {
  const htmlChecks = [];
  const sliceChecks = [];

  for (const route of routes) {
    const normalizedRoute = normalizeRoute(route);
    const liveUrl = buildUrl(liveOrigin, normalizedRoute);
    const localUrl = buildUrl(localOrigin, normalizedRoute);
    const [liveResponse, localResponse] = await Promise.all([
      fetchHtml(liveUrl),
      fetchHtml(localUrl),
    ]);
    const liveTitle = parseTitle(liveResponse.html);
    const localTitle = parseTitle(localResponse.html);

    htmlChecks.push({
      route: normalizedRoute,
      live: {
        status: liveResponse.status,
        titleHtml: liveTitle,
      },
      local: {
        status: localResponse.status,
        titleHtml: localTitle,
      },
      matches: {
        htmlTitle: liveTitle === localTitle,
      },
    });

    if (!skipSliceDiffs) {
      const routeDir = path.join(screenshotsDir, routeToFileStem(normalizedRoute));
      await ensureDir(routeDir);

      const browser = await chromium.launch({ headless: true });

      try {
        for (const viewportName of requestedViewports) {
          sliceChecks.push(
            await compareRouteSlices(browser, normalizedRoute, viewportName, routeDir),
          );
        }
      } catch (error) {
        error.message = `${error.message} (route ${normalizedRoute})`;
        throw error;
      } finally {
        await browser.close();
      }
    }
  }

  return { htmlChecks, sliceChecks };
}

async function auditLinkCoverage(manifest) {
  const manifestRoutes = new Set(manifest.pages.map((entry) => normalizeRoute(entry.route)));
  const brokenRoutes = new Set(
    (manifest.brokenRoutes ?? []).map((entry) => normalizeRoute(entry.route)),
  );
  const bodyDir = path.join(rootDir, "src", "content", "x29", "pages");
  const issues = {
    absoluteInternalLinks: [],
    protocolRelativeInternalLinks: [],
    unresolvedTargets: [],
  };

  for (const page of manifest.pages) {
    const fileStem = routeToFileStem(page.route);
    const bodyPath = path.join(bodyDir, `${fileStem}.body.html`);
    const html = await readFile(bodyPath, "utf8");

    for (const href of extractLinks(html)) {
      if (href.startsWith("https://www.x29.ai")) {
        issues.absoluteInternalLinks.push({ route: page.route, href });
      }

      if (href.startsWith("//www.x29.ai") || href.startsWith("//x29.ai")) {
        issues.protocolRelativeInternalLinks.push({ route: page.route, href });
      }

      if (!href.startsWith("/") || href.startsWith("//")) {
        continue;
      }

      const targetPath = normalizeRoute(href.split(/[?#]/, 1)[0]);

      if (
        targetPath === "/" ||
        targetPath === "/.wf_auth" ||
        manifestRoutes.has(targetPath) ||
        brokenRoutes.has(targetPath)
      ) {
        continue;
      }

      issues.unresolvedTargets.push({ route: page.route, href: targetPath });
    }
  }

  return issues;
}

async function collectFlowResults(screenshotsDir) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: viewportMap.mobile });

  async function snapshot(name) {
    await captureViewport(page, path.join(screenshotsDir, `${name}.png`));
  }

  async function getState() {
    return page.evaluate(() => ({
      url: location.pathname + location.search,
      title: document.title,
      text: document.body.innerText.slice(0, 300),
    }));
  }

  async function clickAndWait(locator) {
    await locator.scrollIntoViewIfNeeded();
    await locator.click();
    await page.waitForTimeout(1_000);
  }

  const flows = [];

  await page.goto(`${localOrigin}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await page.locator(".menu-button").click();
  await page.waitForTimeout(400);
  const menuVisible = await page.evaluate(() => {
    const menu = document.querySelector(".nav-menu");
    if (!(menu instanceof HTMLElement)) {
      return false;
    }

    const styles = getComputedStyle(menu);
    return styles.display !== "none" && styles.opacity !== "0";
  });
  flows.push({
    id: "home-nav-toggle",
    passed: menuVisible,
    details: { menuVisible },
  });
  await snapshot("home-nav-open");

  await clickAndWait(page.locator('.nav-menu a[href="/about"]').first());
  flows.push({
    id: "home-nav-about-link",
    passed: normalizeRoute(new URL(page.url()).pathname) === "/about",
    details: await getState(),
  });
  await snapshot("home-nav-about");

  await page.goto(`${localOrigin}/about`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await clickAndWait(page.locator('section.footer a[href="/contact"]').first());
  flows.push({
    id: "footer-contact-link",
    passed: normalizeRoute(new URL(page.url()).pathname) === "/contact",
    details: await getState(),
  });
  await snapshot("footer-contact-link");

  await page.goto(`${localOrigin}/projects/livingless-3`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(1_000);
  const brokenProjectState = await getState();
  flows.push({
    id: "broken-project-route",
    passed:
      brokenProjectState.url === "/projects/livingless-3" &&
      brokenProjectState.title === "Not Found",
    details: brokenProjectState,
  });
  await snapshot("broken-project-route");

  await page.goto(`${localOrigin}/blog/why-human-ai-is-the-future-of-creative-agencies`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(1_000);
  const brokenBlogState = await getState();
  flows.push({
    id: "broken-blog-route",
    passed:
      brokenBlogState.url === "/blog/why-human-ai-is-the-future-of-creative-agencies" &&
      brokenBlogState.title === "Not Found",
    details: brokenBlogState,
  });
  await snapshot("broken-blog-route");

  await page.goto(`${localOrigin}/401?e=1`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_500);
  const localPasswordErrorVisible = await page.evaluate(() =>
    [...document.querySelectorAll(".w-password-page.w-form-fail")].some(
      (element) => getComputedStyle(element).display !== "none",
    ),
  );
  flows.push({
    id: "local-password-error-state",
    passed: localPasswordErrorVisible,
    details: {
      ...(await getState()),
      failVisible: localPasswordErrorVisible,
    },
  });
  await snapshot("local-password-error-state");

  await page.goto(`${localOrigin}/401`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await page.locator('input[type="password"]').fill("wrong");
  await Promise.all([
    page.waitForURL("**/.wf_auth"),
    page.locator('input[type="submit"]').click(),
  ]);
  await page.waitForTimeout(1_000);
  const localPasswordState = await getState();
  flows.push({
    id: "local-password-submit",
    passed:
      localPasswordState.url === "/.wf_auth" &&
      localPasswordState.title === "Not Found",
    details: localPasswordState,
  });
  await snapshot("local-password-submit");

  await page.goto(`${liveOrigin}/401`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await page.locator('input[type="password"]').fill("wrong");
  await Promise.all([
    page.waitForURL("**/.wf_auth"),
    page.locator('input[type="submit"]').click(),
  ]);
  await page.waitForTimeout(1_000);
  const livePasswordState = await getState();
  flows.push({
    id: "live-password-submit-reference",
    passed:
      livePasswordState.url === "/.wf_auth" &&
      livePasswordState.title === "Not Found",
    details: livePasswordState,
  });
  await snapshot("live-password-submit-reference");

  await page.goto(`${localOrigin}/contact`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const contactMailto = await page.locator('a[href^="mailto:"]').first().getAttribute("href");
  flows.push({
    id: "contact-mailto-link",
    passed: contactMailto?.toLowerCase() === "mailto:contact@x29.ai",
    details: { href: contactMailto },
  });
  await snapshot("contact-mailto-link");

  await browser.close();
  return flows;
}

async function main() {
  const manifest = await loadManifest();
  const routeList = [
    ...manifest.pages.map((entry) => normalizeRoute(entry.route)),
    ...manifest.brokenRoutes.map((entry) => normalizeRoute(entry.route)),
  ];
  const uniqueRoutes = [...new Set(routeList)].filter((route) => {
    return requestedRoutes.size === 0 || requestedRoutes.has(route);
  });
  const routeScreenshotsDir = path.join(outputDir, "routes");
  const flowScreenshotsDir = path.join(outputDir, "flows");

  await ensureDir(routeScreenshotsDir);
  await ensureDir(flowScreenshotsDir);

  const routeParity = await compareRouteParity(uniqueRoutes, routeScreenshotsDir);
  const linkCoverage = await auditLinkCoverage(manifest);
  const flowResults = await collectFlowResults(flowScreenshotsDir);

  const sliceSummary = routeParity.sliceChecks.reduce(
    (accumulator, entry) => {
      accumulator.total += 1;
      if (entry.diffSummary.maxDiffPercentage === 0) {
        accumulator.zeroDiff += 1;
      }
      if (entry.linkRewriteClean) {
        accumulator.linkClean += 1;
      }
      if (entry.local.status === entry.live.status) {
        accumulator.statusMatch += 1;
      }
      if (entry.matches.browserTitle) {
        accumulator.titleMatch += 1;
      }
      return accumulator;
    },
    { total: 0, zeroDiff: 0, linkClean: 0, statusMatch: 0, titleMatch: 0 },
  );

  const flowSummary = flowResults.reduce(
    (accumulator, entry) => {
      accumulator.total += 1;
      if (entry.passed) {
        accumulator.passed += 1;
      }
      return accumulator;
    },
    { total: 0, passed: 0 },
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    liveOrigin,
    localOrigin,
    routeCount: uniqueRoutes.length,
    viewports: requestedViewports,
    stepRatios,
    htmlTitleChecks: routeParity.htmlChecks,
    sliceSummary,
    sliceChecks: routeParity.sliceChecks,
    linkCoverage: {
      absoluteInternalLinks: linkCoverage.absoluteInternalLinks.length,
      protocolRelativeInternalLinks: linkCoverage.protocolRelativeInternalLinks.length,
      unresolvedTargets: linkCoverage.unresolvedTargets,
    },
    flowSummary,
    flowChecks: flowResults,
  };

  await writeFile(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log(
    JSON.stringify(
      {
        outputPath: path.relative(rootDir, path.join(outputDir, "summary.json")),
        sliceSummary,
        flowSummary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
