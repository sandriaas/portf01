#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', 'design-references', 'shopify.design');
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'research',
  'shopify.design',
  'browser-parity-2026-04-09.json',
);
const LOCAL_URL = process.env.SHOPIFY_LOCAL_URL ?? 'http://127.0.0.1:3005/';
const LIVE_URL = 'https://shopify.design/';
const DATE_TAG = '2026-04-09';
const MAX_CAPTURE_HEIGHT = 24_000;
const CAPTURE_MODE = process.env.SHOPIFY_CAPTURE_MODE ?? 'connected';
const PLAYWRITER_TIMEOUT = Number(process.env.SHOPIFY_PLAYWRITER_TIMEOUT ?? 120_000);
const PLAYWRITER_MARKER = '__SHOPIFY_PARITY_RESULT__';
const CAPTURE_FALLBACK_STYLE = `
.layout-root.loading-fallback,.layout-root.codex-capture-fallback{--codex-loading-fallback:1}
.layout-root.loading-fallback .site-header,.layout-root.codex-capture-fallback .site-header{top:0;opacity:1;animation:none!important}
.layout-root.loading-fallback .hero,.layout-root.codex-capture-fallback .hero{transform:translateY(0);animation:none!important}
.layout-root.loading-fallback .hero-live-bar,.layout-root.codex-capture-fallback .hero-live-bar,.layout-root.loading-fallback [data-reveal="headline-artifact"],.layout-root.codex-capture-fallback [data-reveal="headline-artifact"],.layout-root.loading-fallback .carousel-card-shell,.layout-root.codex-capture-fallback .carousel-card-shell{opacity:1!important;animation:none!important}
.layout-root.loading-fallback .hero-live-bar,.layout-root.codex-capture-fallback .hero-live-bar{clip-path:inset(0 0 0 0)}
.layout-root.loading-fallback .hero-grid-card,.layout-root.codex-capture-fallback .hero-grid-card,.layout-root.loading-fallback .carousel-card-shell,.layout-root.codex-capture-fallback .carousel-card-shell{opacity:1!important;transform:none!important;animation:none!important;transition:none!important}
.layout-root.loading-fallback .wr .wr-text,.layout-root.codex-capture-fallback .wr .wr-text{color:inherit!important;transform:none!important;animation:none!important}
.layout-root.loading-fallback .wr .wr-text::before,.layout-root.codex-capture-fallback .wr .wr-text::before{visibility:hidden!important;animation:none!important}
`;
const CONNECTED_CAPTURE_STYLE = `
html{scroll-behavior:auto!important}
*,*::before,*::after{
  transition:none!important;
  animation-play-state:paused!important;
  caret-color:transparent!important;
}
`;
const PAGE_TARGETS = [
  {
    name: `live-desktop-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'desktop',
    kind: 'page',
  },
  {
    name: `local-desktop-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'desktop',
    kind: 'page',
  },
  {
    name: `live-tablet-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 768, height: 1800 },
    pairKey: 'tablet',
    kind: 'page',
  },
  {
    name: `local-tablet-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 768, height: 1800 },
    pairKey: 'tablet',
    kind: 'page',
  },
  {
    name: `live-mobile-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 390, height: 1600 },
    pairKey: 'mobile',
    kind: 'page',
  },
  {
    name: `local-mobile-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 390, height: 1600 },
    pairKey: 'mobile',
    kind: 'page',
  },
];
const STATE_TARGETS = [
  {
    name: `live-manifesto-modal-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'manifesto-modal',
    kind: 'state',
    action: 'manifesto',
  },
  {
    name: `local-manifesto-modal-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'manifesto-modal',
    kind: 'state',
    action: 'manifesto',
  },
  {
    name: `live-carousel-modal-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'carousel-modal',
    kind: 'state',
    action: 'carousel',
  },
  {
    name: `local-carousel-modal-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'carousel-modal',
    kind: 'state',
    action: 'carousel',
  },
  {
    name: `live-remote-state-${DATE_TAG}`,
    url: LIVE_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'remote-state',
    kind: 'state',
    action: 'remote',
  },
  {
    name: `local-remote-state-${DATE_TAG}`,
    url: LOCAL_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'remote-state',
    kind: 'state',
    action: 'remote',
  },
];
const TARGETS = [...PAGE_TARGETS, ...STATE_TARGETS];
const PAIRS = [
  {
    name: 'desktop',
    live: `live-desktop-${DATE_TAG}`,
    local: `local-desktop-${DATE_TAG}`,
    compareFullPage: true,
  },
  {
    name: 'tablet',
    live: `live-tablet-${DATE_TAG}`,
    local: `local-tablet-${DATE_TAG}`,
    compareFullPage: true,
  },
  {
    name: 'mobile',
    live: `live-mobile-${DATE_TAG}`,
    local: `local-mobile-${DATE_TAG}`,
    compareFullPage: true,
  },
  {
    name: 'manifesto-modal',
    live: `live-manifesto-modal-${DATE_TAG}`,
    local: `local-manifesto-modal-${DATE_TAG}`,
    compareFullPage: false,
  },
  {
    name: 'carousel-modal',
    live: `live-carousel-modal-${DATE_TAG}`,
    local: `local-carousel-modal-${DATE_TAG}`,
    compareFullPage: false,
  },
  {
    name: 'remote-state',
    live: `live-remote-state-${DATE_TAG}`,
    local: `local-remote-state-${DATE_TAG}`,
    compareFullPage: false,
  },
];

function toRelativePath(filePath) {
  return path.relative(ROOT, filePath);
}

async function runCommand(command, args, { timeout = 60_000 } = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: ROOT,
      timeout,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (error) {
    const detail = [error.stdout, error.stderr].filter(Boolean).join('\n').trim();
    const suffix = detail ? `\n${detail}` : '';
    throw new Error(`Command failed: ${command} ${args.join(' ')}${suffix}`);
  }
}

function extractMarkedJson(output, marker = PLAYWRITER_MARKER) {
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find playwriter result marker in output:\n${output}`);
  }

  const payload = output.slice(markerIndex + marker.length).trim();
  const jsonLine = payload.split('\n')[0].trim();
  return JSON.parse(jsonLine);
}

async function createPlaywriterSession() {
  const { stdout } = await runCommand('playwriter', ['session', 'new'], {
    timeout: 30_000,
  });
  const match = stdout.match(/Session\s+(\d+)/);
  if (!match) {
    throw new Error(`Unable to parse playwriter session id from output:\n${stdout}`);
  }
  return Number(match[1]);
}

async function deletePlaywriterSession(sessionId) {
  try {
    await runCommand('playwriter', ['session', 'delete', String(sessionId)], {
      timeout: 15_000,
    });
  } catch {
    // Best-effort cleanup only.
  }
}

function isRecoverablePlaywriterError(error) {
  return /Target\.createTarget|call reset to reconnect|Extension request timeout|browserContext\.newPage/i
    .test(error instanceof Error ? error.message : String(error));
}

async function resetPlaywriterSession(sessionId) {
  await runCommand('playwriter', ['session', 'reset', String(sessionId)], {
    timeout: 20_000,
  });
}

async function runPlaywriterCode(sessionId, code, { allowRetry = true } = {}) {
  try {
    const { stdout, stderr } = await runCommand(
      'playwriter',
      ['-s', String(sessionId), '--timeout', String(PLAYWRITER_TIMEOUT), '-e', code],
      { timeout: PLAYWRITER_TIMEOUT + 15_000 },
    );
    return `${stdout}\n${stderr}`.trim();
  } catch (error) {
    if (!allowRetry || !isRecoverablePlaywriterError(error)) {
      throw error;
    }

    await resetPlaywriterSession(sessionId);
    return await runPlaywriterCode(sessionId, code, { allowRetry: false });
  }
}

async function warmPlaywriterSession(sessionId) {
  await runPlaywriterCode(
    sessionId,
    `console.log(${JSON.stringify(PLAYWRITER_MARKER)} + JSON.stringify({ warm: true, pages: context.pages().length }));`,
  );
}

function buildConnectedCaptureCode(target, screenshotPath, fullPageScreenshotPath) {
  const payload = {
    marker: PLAYWRITER_MARKER,
    name: target.name,
    kind: target.kind,
    url: target.url,
    viewport: target.viewport,
    pairKey: target.pairKey,
    action: target.action ?? null,
    screenshotPath,
    fullPageScreenshotPath,
    stableStyleText: CONNECTED_CAPTURE_STYLE,
    fallbackStyleText: CAPTURE_FALLBACK_STYLE,
    freezeVideoAtSeconds: 1,
  };

  return `
const payload = ${JSON.stringify(payload)};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function pageMatchesUrl(page, url) {
  try {
    const expected = new URL(url);
    expected.hash = '';
    const actual = new URL(page.url());
    actual.hash = '';
    return actual.origin === expected.origin && actual.pathname === expected.pathname;
  } catch {
    return false;
  }
}

async function stabilizePage(page) {
  return await page.evaluate(async (options) => {
    const waitFor = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const doubleFrame = async () => {
      await nextFrame();
      await nextFrame();
    };
    const ensureStyle = (id, text) => {
      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
      }
      style.textContent = text;
    };
    const waitForImages = async () => {
      const pending = Array.from(document.images).filter((image) => !image.complete);
      await Promise.allSettled(
        pending.map(
          (image) =>
            new Promise((resolve) => {
              const done = () => resolve();
              image.addEventListener('load', done, { once: true });
              image.addEventListener('error', done, { once: true });
              window.setTimeout(done, 3_000);
            }),
        ),
      );
    };
    const waitForVideos = async (videos) => {
      await Promise.allSettled(
        videos.map(
          (video) =>
            new Promise((resolve) => {
              if (video.readyState >= 2) {
                resolve();
                return;
              }

              const done = () => resolve();
              video.addEventListener('loadeddata', done, { once: true });
              video.addEventListener('error', done, { once: true });
              window.setTimeout(done, 5_000);
              try {
                video.load();
              } catch {}
            }),
        ),
      );
    };
    const freezeVideos = async (videos) => {
      await Promise.allSettled(
        videos.map(async (video) => {
          try {
            video.pause();
            video.muted = true;
            video.playbackRate = 0;
            const duration = Number.isFinite(video.duration) && video.duration > 0
              ? video.duration
              : options.freezeVideoAtSeconds;
            const targetTime = Math.max(
              0,
              Math.min(options.freezeVideoAtSeconds, Math.max(0, duration - 0.05)),
            );
            const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            if (Math.abs(currentTime - targetTime) > 0.01) {
              const seeked = new Promise((resolve) => {
                const done = () => resolve();
                video.addEventListener('seeked', done, { once: true });
                window.setTimeout(done, 2_000);
              });
              video.currentTime = targetTime;
              await seeked;
            }
            video.pause();
          } catch {}
        }),
      );
    };

    ensureStyle('codex-capture-stable-style', options.stableStyleText);
    ensureStyle('codex-capture-fallback-style', options.fallbackStyleText);

    try {
      if (document.fonts?.ready) {
        await Promise.race([document.fonts.ready, waitFor(5_000)]);
      }
    } catch {}

    await waitForImages();

    const root = document.querySelector('.layout-root');
    let appliedFallback = false;
    if (root?.classList.contains('loading')) {
      root.classList.add('codex-capture-fallback');
      root.classList.remove('loading');
      appliedFallback = true;
    }

    const overlays = Array.from(document.querySelectorAll('div')).filter((element) => {
      const computed = getComputedStyle(element);
      return computed.position === 'fixed' && computed.zIndex === '99999';
    });
    overlays.forEach((element) => element.remove());

    const webglFallbacks = Array.from(document.querySelectorAll('div')).filter((element) => {
      const computed = getComputedStyle(element);
      return (
        computed.position === 'fixed' &&
        computed.inset === '0px' &&
        element.textContent?.includes('This experience requires WebGL')
      );
    });
    webglFallbacks.forEach((element) => element.remove());

    const videos = Array.from(document.querySelectorAll('video'));
    await waitForVideos(videos);
    await freezeVideos(videos);

    window.scrollTo(0, 0);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('site-ready'));
    await waitFor(200);
    await doubleFrame();

    return {
      appliedFallback,
      removedOverlayCount: overlays.length,
      removedWebglFallbackCount: webglFallbacks.length,
      layoutRootClass: root?.className ?? null,
      documentHeight: document.documentElement.scrollHeight,
      imageCount: document.images.length,
      videoCount: videos.length,
    };
  }, options);
}

async function stabilizeAfterAction(page, freezeVideoAtSeconds) {
  await page.evaluate(async (targetTime) => {
    const waitFor = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const videos = Array.from(document.querySelectorAll('video'));

    await Promise.allSettled(
      videos.map(async (video) => {
        try {
          video.pause();
          video.muted = true;
          video.playbackRate = 0;
          const duration = Number.isFinite(video.duration) && video.duration > 0
            ? video.duration
            : targetTime;
          const safeTarget = Math.max(0, Math.min(targetTime, Math.max(0, duration - 0.05)));
          const currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
          if (Math.abs(currentTime - safeTarget) > 0.01) {
            const seeked = new Promise((resolve) => {
              const done = () => resolve();
              video.addEventListener('seeked', done, { once: true });
              window.setTimeout(done, 2_000);
            });
            video.currentTime = safeTarget;
            await seeked;
          }
          video.pause();
        } catch {}
      }),
    );

    await waitFor(200);
    await nextFrame();
    await nextFrame();
  }, freezeVideoAtSeconds);
}

async function performAction(page, action) {
  if (action === 'manifesto') {
    const button = page.locator('.manifesto-btn').first();
    await button.scrollIntoViewIfNeeded();
    await wait(300);
    await button.click({ force: true, noWaitAfter: true });
    await wait(800);
    return;
  }

  if (action === 'carousel') {
    const card = page.locator('.carousel-card--interactive').first();
    await card.scrollIntoViewIfNeeded();
    await wait(300);
    await card.click({ force: true, noWaitAfter: true });
    await wait(800);
    return;
  }

  if (action === 'remote') {
    const thumb = page.locator('.remote-studio-thumb').first();
    await thumb.scrollIntoViewIfNeeded();
    await wait(300);
    await thumb.click({ force: true, noWaitAfter: true });
    await wait(800);
  }
}

let page = context.pages().find((candidate) => pageMatchesUrl(candidate, payload.url));
if (page == null) {
  page = await context.newPage();
}

await page.setViewportSize(payload.viewport);
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(60_000);
await page.goto(payload.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await wait(2_200);

const prep = await stabilizePage(page);

if (payload.action) {
  await performAction(page, payload.action);
  await stabilizeAfterAction(page, payload.freezeVideoAtSeconds);
}

await page.evaluate(() => window.scrollTo(0, 0));
await wait(200);

const counts = await page.evaluate(() => ({
  headerCta: document.querySelectorAll('.header-cta-link').length,
  heroCards: document.querySelectorAll('.hero-grid-card').length,
  manifestoButtons: document.querySelectorAll('.manifesto-btn').length,
  carouselCards: document.querySelectorAll('.carousel-card--interactive').length,
  remoteThumbs: document.querySelectorAll('.remote-studio-thumb').length,
  footerLinks: document.querySelectorAll('.site-footer a').length,
  modalOverlayCount: document.querySelectorAll('.ws3-modal-overlay').length,
  layoutRootClass: document.querySelector('.layout-root')?.className ?? null,
  title: document.title,
  canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
  documentHeight: document.documentElement.scrollHeight,
}));

const state = await page.evaluate(() => ({
  hash: window.location.hash,
  modalHidden: document.querySelector('.ws3-modal-overlay')?.getAttribute('aria-hidden') ?? null,
}));

await page.screenshot({
  path: payload.screenshotPath,
  scale: 'css',
  animations: 'disabled',
  caret: 'hide',
  timeout: 120_000,
});

if (payload.fullPageScreenshotPath) {
  await page.screenshot({
    path: payload.fullPageScreenshotPath,
    fullPage: true,
    scale: 'css',
    animations: 'disabled',
    caret: 'hide',
    timeout: 120_000,
  });
}

console.log(payload.marker + JSON.stringify({
  name: payload.name,
  kind: payload.kind,
  url: payload.url,
  viewport: payload.viewport,
  pairKey: payload.pairKey,
  action: payload.action,
  prep,
  counts,
  state,
}));
`;
}

async function waitForStablePage(page, { aggressive = false } = {}) {
  if (aggressive) {
    await page.waitForTimeout(800);
    return;
  }

  try {
    await page.waitForLoadState('networkidle', { timeout: 4_000 });
  } catch {
    // The homepage streams media and motion continuously, so network idle is best-effort.
  }

  await page.waitForTimeout(1_200);
}

async function applyCaptureFallback(page, { hideCanvas = true } = {}) {
  return page.evaluate(({ styleText, shouldHideCanvas }) => {
    const root = document.querySelector('.layout-root');
    if (!root) {
      return { applied: false, layoutRootClass: null, removedOverlay: false };
    }

    let style = document.getElementById('codex-capture-fallback-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'codex-capture-fallback-style';
      style.textContent = styleText;
      document.head.appendChild(style);
    }

    const overlay = Array.from(document.querySelectorAll('div')).find((element) => {
      const computed = getComputedStyle(element);
      return computed.position === 'fixed' && computed.zIndex === '99999';
    });
    overlay?.remove();

    const webglFallback = Array.from(document.querySelectorAll('div')).find((element) => {
      const computed = getComputedStyle(element);
      return (
        computed.position === 'fixed' &&
        computed.inset === '0px' &&
        element.textContent?.includes('This experience requires WebGL')
      );
    });
    webglFallback?.remove();

    let applied = false;
    if (root.classList.contains('loading')) {
      root.classList.add('codex-capture-fallback');
      root.classList.remove('loading');
      applied = true;
    }

    window.dispatchEvent(new Event('site-ready'));
    window.dispatchEvent(new Event('resize'));

    const canvases = Array.from(document.querySelectorAll('canvas'));
    if (shouldHideCanvas) {
      for (const canvas of canvases) {
        canvas.style.display = 'none';
      }
    }

    return {
      applied,
      layoutRootClass: root.className,
      removedOverlay: !!overlay,
      removedWebglFallback: !!webglFallback,
      hiddenCanvasCount: shouldHideCanvas ? canvases.length : 0,
    };
  }, { styleText: CAPTURE_FALLBACK_STYLE, shouldHideCanvas: hideCanvas });
}

async function collectCounts(page) {
  return page.evaluate(() => ({
    headerCta: document.querySelectorAll('.header-cta-link').length,
    heroCards: document.querySelectorAll('.hero-grid-card').length,
    manifestoButtons: document.querySelectorAll('.manifesto-btn').length,
    carouselCards: document.querySelectorAll('.carousel-card--interactive').length,
    remoteThumbs: document.querySelectorAll('.remote-studio-thumb').length,
    footerLinks: document.querySelectorAll('.site-footer a').length,
    modalOverlayCount: document.querySelectorAll('.ws3-modal-overlay').length,
    layoutRootClass: document.querySelector('.layout-root')?.className ?? null,
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    documentHeight: document.documentElement.scrollHeight,
  }));
}

async function waitForImages(page) {
  try {
    await page.evaluate(async () => {
      const pending = Array.from(document.images).filter((image) => !image.complete);
      await Promise.allSettled(
        pending.map(
          (image) =>
            new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
              window.setTimeout(resolve, 3_000);
            }),
        ),
      );
    });
  } catch {
    // Best-effort only.
  }

  await page.waitForTimeout(250);
}

async function writePng(filePath, png) {
  await fs.writeFile(filePath, PNG.sync.write(png));
}

async function captureFullPageTiled(page, outPath, viewport) {
  const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const captureHeight = Math.min(totalHeight, MAX_CAPTURE_HEIGHT);
  const stitched = new PNG({ width: viewport.width, height: captureHeight });
  stitched.data.fill(255);

  for (let top = 0; top < captureHeight; top += viewport.height) {
    const clipHeight = Math.min(viewport.height, captureHeight - top);
    await page.evaluate((nextTop) => window.scrollTo(0, nextTop), top);
    await page.waitForTimeout(120);

    const tileBuffer = await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: clipHeight,
      },
      timeout: 120_000,
    });
    const tile = PNG.sync.read(tileBuffer);
    PNG.bitblt(tile, stitched, 0, 0, viewport.width, clipHeight, 0, top);
  }

  await writePng(outPath, stitched);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);

  return {
    totalHeight,
    capturedHeight: captureHeight,
    truncated: captureHeight !== totalHeight,
  };
}

async function captureTargetsHeadless() {
  const results = [];

  for (const target of PAGE_TARGETS) {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-software-rasterizer',
      ],
    });

    try {
      const page = await browser.newPage({
        viewport: target.viewport,
        deviceScaleFactor: 1,
      });
      page.setDefaultTimeout(45_000);
      await page.route(/\.(?:mp4|webm|mov|m4v|mp3)(?:\?.*)?$/i, (route) => route.abort());

      await page.goto(target.url, { waitUntil: 'domcontentloaded' });
      await waitForStablePage(page, { aggressive: target.url === LIVE_URL });
      const captureFallback = await applyCaptureFallback(page);
      await page.waitForTimeout(captureFallback.applied ? 200 : 100);
      await waitForImages(page);

      const screenshotPath = path.join(OUT_DIR, `${target.name}.png`);
      const fullPageScreenshotPath = path.join(OUT_DIR, `${target.name}-full.png`);
      const fullPageCapture = await captureFullPageTiled(
        page,
        fullPageScreenshotPath,
        target.viewport,
      );

      await page.screenshot({
        path: screenshotPath,
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
        timeout: 120_000,
      });

      results.push({
        name: target.name,
        kind: target.kind,
        url: target.url,
        viewport: target.viewport,
        pairKey: target.pairKey,
        counts: await collectCounts(page),
        captureFallback,
        state: {
          hash: await page.evaluate(() => window.location.hash),
          modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden').catch(() => null),
        },
        fullPageCapture,
        screenshot: toRelativePath(screenshotPath),
        fullPageScreenshot: toRelativePath(fullPageScreenshotPath),
      });

      await page.close();
    } finally {
      await browser.close();
    }
  }

  return results;
}

async function captureInteractionChecksHeadless() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 2200 },
      deviceScaleFactor: 1,
    });
    page.setDefaultTimeout(45_000);
    await page.route(/\.(?:mp4|webm|mov|m4v|mp3)(?:\?.*)?$/i, (route) => route.abort());

    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded' });
    await waitForStablePage(page);
    await applyCaptureFallback(page);
    await page.waitForTimeout(400);

    const interactionChecks = [];

    const manifestoButton = page.locator('.manifesto-btn').first();
    await manifestoButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await manifestoButton.click({ noWaitAfter: true });
    await page.waitForTimeout(800);
    interactionChecks.push({
      check: 'manifesto modal opens',
      modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden'),
    });
    await page.screenshot({
      path: path.join(OUT_DIR, `local-manifesto-modal-${DATE_TAG}.png`),
      animations: 'disabled',
      timeout: 120_000,
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    const firstCarouselCard = page.locator('.carousel-card--interactive').first();
    await firstCarouselCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await firstCarouselCard.click({ noWaitAfter: true });
    await page.waitForTimeout(800);
    interactionChecks.push({
      check: 'carousel modal opens',
      modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden'),
      hash: await page.evaluate(() => window.location.hash),
    });
    await page.screenshot({
      path: path.join(OUT_DIR, `local-carousel-modal-${DATE_TAG}.png`),
      animations: 'disabled',
      timeout: 120_000,
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    const remoteThumb = page.locator('.remote-studio-thumb').first();
    await remoteThumb.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await remoteThumb.click({ force: true, noWaitAfter: true });
    await page.waitForTimeout(800);
    interactionChecks.push({
      check: 'remote studio interaction responds',
      modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden').catch(() => null),
      hash: await page.evaluate(() => window.location.hash),
    });
    await page.screenshot({
      path: path.join(OUT_DIR, `local-remote-state-${DATE_TAG}.png`),
      animations: 'disabled',
      timeout: 120_000,
    });

    await page.close();
    return interactionChecks;
  } finally {
    await browser.close();
  }
}

async function captureTargetsConnected() {
  const results = [];
  const sessionId = await createPlaywriterSession();

  try {
    await warmPlaywriterSession(sessionId);

    for (const target of TARGETS) {
      const screenshotPath = path.join(OUT_DIR, `${target.name}.png`);
      const fullPageScreenshotPath = target.kind === 'page'
        ? path.join(OUT_DIR, `${target.name}-full.png`)
        : null;
      const output = await runPlaywriterCode(
        sessionId,
        buildConnectedCaptureCode(target, screenshotPath, fullPageScreenshotPath),
      );
      const parsed = extractMarkedJson(output);

      results.push({
        name: target.name,
        kind: target.kind,
        url: target.url,
        viewport: target.viewport,
        pairKey: target.pairKey,
        action: target.action ?? null,
        counts: parsed.counts,
        captureFallback: parsed.prep,
        state: parsed.state,
        screenshot: toRelativePath(screenshotPath),
        fullPageScreenshot: fullPageScreenshotPath ? toRelativePath(fullPageScreenshotPath) : null,
      });
    }
  } finally {
    await deletePlaywriterSession(sessionId);
  }

  return results;
}

function cropToSize(png, width, height) {
  if (png.width === width && png.height === height) {
    return png;
  }

  const cropped = new PNG({ width, height });
  PNG.bitblt(png, cropped, 0, 0, width, height, 0, 0);
  return cropped;
}

async function createImageDiff({ name, livePath, localPath }) {
  const [liveBuffer, localBuffer] = await Promise.all([
    fs.readFile(livePath),
    fs.readFile(localPath),
  ]);
  const livePng = PNG.sync.read(liveBuffer);
  const localPng = PNG.sync.read(localBuffer);
  const width = Math.min(livePng.width, localPng.width);
  const height = Math.min(livePng.height, localPng.height);
  const liveCropped = cropToSize(livePng, width, height);
  const localCropped = cropToSize(localPng, width, height);
  const diffPng = new PNG({ width, height });
  const mismatchPixels = pixelmatch(
    liveCropped.data,
    localCropped.data,
    diffPng.data,
    width,
    height,
    { threshold: 0.1, includeAA: false },
  );
  const diffPath = path.join(OUT_DIR, `${name}-diff.png`);
  await fs.writeFile(diffPath, PNG.sync.write(diffPng));

  return {
    width,
    height,
    mismatchPixels,
    mismatchRatio: Number((mismatchPixels / (width * height)).toFixed(6)),
    diffImage: toRelativePath(diffPath),
  };
}

async function createDiffs(results) {
  const byName = new Map(results.map((result) => [result.name, result]));
  const diffs = [];

  for (const pair of PAIRS) {
    const live = byName.get(pair.live);
    const local = byName.get(pair.local);
    if (!live || !local) {
      continue;
    }

    const viewportDiff = await createImageDiff({
      name: `${pair.name}-${DATE_TAG}`,
      livePath: path.join(ROOT, live.screenshot),
      localPath: path.join(ROOT, local.screenshot),
    });

    const diffEntry = {
      pair: pair.name,
      viewportDiff,
      liveState: live.state ?? null,
      localState: local.state ?? null,
    };

    if (pair.compareFullPage && live.fullPageScreenshot && local.fullPageScreenshot) {
      diffEntry.fullPageDiff = await createImageDiff({
        name: `${pair.name}-full-${DATE_TAG}`,
        livePath: path.join(ROOT, live.fullPageScreenshot),
        localPath: path.join(ROOT, local.fullPageScreenshot),
      });
    }

    diffs.push(diffEntry);
  }

  return diffs;
}

function summarizeInteractionChecks(results) {
  return results
    .filter((result) => result.kind === 'state')
    .map((result) => ({
      check: result.name,
      action: result.action,
      modalHidden: result.state?.modalHidden ?? null,
      hash: result.state?.hash ?? null,
      modalOverlayCount: result.counts?.modalOverlayCount ?? null,
    }));
}

async function main() {
  if (!['connected', 'headless'].includes(CAPTURE_MODE)) {
    throw new Error(`Unsupported SHOPIFY_CAPTURE_MODE: ${CAPTURE_MODE}`);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  const results = CAPTURE_MODE === 'connected'
    ? await captureTargetsConnected()
    : await captureTargetsHeadless();
  const diffs = await createDiffs(results);
  const interactionChecks = CAPTURE_MODE === 'connected'
    ? summarizeInteractionChecks(results)
    : await captureInteractionChecksHeadless();

  const payload = {
    generatedAt: new Date().toISOString(),
    captureMode: CAPTURE_MODE,
    localUrl: LOCAL_URL,
    liveUrl: LIVE_URL,
    results,
    diffs,
    interactionChecks,
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
