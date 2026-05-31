#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const DATE_TAG = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(ROOT, 'docs', 'design-references', 'shopify.design');
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'research',
  'shopify.design',
  `browser-parity-${DATE_TAG}.json`,
);
const LOCAL_URL = process.env.SHOPIFY_LOCAL_URL ?? 'http://127.0.0.1:3005/';
const LIVE_URL = 'https://shopify.design/';
const PLAYWRITER_TIMEOUT_MS = 180_000;
const PAGE_TIMEOUT_MS = 60_000;
const PLAYWRITER_MAX_BUFFER = 16 * 1024 * 1024;
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
const TARGETS = [
  {
    name: `live-desktop-${DATE_TAG}`,
    stateKey: 'liveDesktop',
    url: LIVE_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'desktop',
  },
  {
    name: `local-desktop-${DATE_TAG}`,
    stateKey: 'localDesktop',
    url: LOCAL_URL,
    viewport: { width: 1440, height: 2200 },
    pairKey: 'desktop',
  },
  {
    name: `live-tablet-${DATE_TAG}`,
    stateKey: 'liveTablet',
    url: LIVE_URL,
    viewport: { width: 768, height: 1800 },
    pairKey: 'tablet',
  },
  {
    name: `local-tablet-${DATE_TAG}`,
    stateKey: 'localTablet',
    url: LOCAL_URL,
    viewport: { width: 768, height: 1800 },
    pairKey: 'tablet',
  },
  {
    name: `live-mobile-${DATE_TAG}`,
    stateKey: 'liveMobile',
    url: LIVE_URL,
    viewport: { width: 390, height: 1600 },
    pairKey: 'mobile',
  },
  {
    name: `local-mobile-${DATE_TAG}`,
    stateKey: 'localMobile',
    url: LOCAL_URL,
    viewport: { width: 390, height: 1600 },
    pairKey: 'mobile',
  },
];
const PAIRS = [
  {
    name: 'desktop',
    live: `live-desktop-${DATE_TAG}`,
    local: `local-desktop-${DATE_TAG}`,
  },
  {
    name: 'tablet',
    live: `live-tablet-${DATE_TAG}`,
    local: `local-tablet-${DATE_TAG}`,
  },
  {
    name: 'mobile',
    live: `live-mobile-${DATE_TAG}`,
    local: `local-mobile-${DATE_TAG}`,
  },
];

function playwriterCaptureFallbackSource() {
  return `
    (styleText) => {
      const root = document.querySelector('.layout-root');
      if (!root) {
        return {
          applied: false,
          layoutRootClass: null,
          removedOverlay: false,
          removedWebglFallback: false,
          hiddenCanvasCount: 0,
        };
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
      const webglFallback = Array.from(document.querySelectorAll('div')).find((element) => {
        const computed = getComputedStyle(element);
        return (
          computed.position === 'fixed' &&
          element.textContent?.includes('This experience requires WebGL')
        );
      });

      let applied = false;
      let hiddenCanvasCount = 0;
      if (root.classList.contains('loading')) {
        root.classList.add('codex-capture-fallback');
        root.classList.remove('loading');
        overlay?.remove();
        webglFallback?.remove();
        const canvases = Array.from(document.querySelectorAll('canvas'));
        hiddenCanvasCount = canvases.length;
        for (const canvas of canvases) {
          canvas.style.display = 'none';
        }
        applied = true;
      }

      window.dispatchEvent(new Event('site-ready'));
      window.dispatchEvent(new Event('resize'));

      return {
        applied,
        layoutRootClass: root.className,
        removedOverlay: !!overlay,
        removedWebglFallback: !!webglFallback,
        hiddenCanvasCount,
      };
    }
  `;
}

function buildPlaywriterCode(code) {
  return `
const fs = require('node:fs');
${code}
`.trim();
}

async function commandExists(command, args = ['--version']) {
  try {
    await execFileAsync(command, args, {
      cwd: ROOT,
      maxBuffer: PLAYWRITER_MAX_BUFFER,
    });
    return true;
  } catch {
    return false;
  }
}

async function resolvePlaywriterCommand() {
  if (await commandExists('playwriter')) {
    return { command: 'playwriter', baseArgs: [] };
  }

  if (await commandExists('npx', ['playwriter@latest', '--version'])) {
    return { command: 'npx', baseArgs: ['playwriter@latest'] };
  }

  throw new Error('Playwriter CLI is not available. Install it or expose it on PATH.');
}

async function runPlaywriter(playwriter, args) {
  const { stdout, stderr } = await execFileAsync(
    playwriter.command,
    [...playwriter.baseArgs, ...args],
    {
      cwd: ROOT,
      maxBuffer: PLAYWRITER_MAX_BUFFER,
    },
  );

  return `${stdout}${stderr}`;
}

async function createPlaywriterSession(playwriter) {
  const output = await runPlaywriter(playwriter, ['session', 'new']);
  const match = output.match(/Session\s+(\d+)\s+created/i);

  if (!match) {
    throw new Error(`Unable to create playwriter session.\n${output}`);
  }

  return Number(match[1]);
}

async function deletePlaywriterSession(playwriter, sessionId) {
  try {
    await runPlaywriter(playwriter, ['session', 'delete', String(sessionId)]);
  } catch {
    // Session cleanup is best-effort.
  }
}

async function runPlaywriterEval(playwriter, sessionId, code, timeoutMs = PLAYWRITER_TIMEOUT_MS) {
  return runPlaywriter(playwriter, [
    '-s',
    String(sessionId),
    '--timeout',
    String(timeoutMs),
    '-e',
    code,
  ]);
}

async function captureTargetWithPlaywriter(playwriter, sessionId, target) {
  const screenshotPath = path.join(OUT_DIR, `${target.name}.png`);
  const fullPageScreenshotPath = path.join(OUT_DIR, `${target.name}-full.png`);
  const resultPath = path.join(OUT_DIR, `${target.name}.json`);
  const fallbackStyle = JSON.stringify(CAPTURE_FALLBACK_STYLE);
  const fallbackSource = playwriterCaptureFallbackSource();
  const code = buildPlaywriterCode(`
const stateKey = ${JSON.stringify(target.stateKey)};
if (!state[stateKey] || state[stateKey].isClosed()) {
  state[stateKey] = context.pages().find((page) => page.url() === 'about:blank') ?? (await context.newPage());
}
const page = state[stateKey];
page.setDefaultTimeout(${PAGE_TIMEOUT_MS});

const routeKey = '__media_route__' + stateKey;
if (!state[routeKey]) {
  try {
    await page.route(/\\.(?:mp4|webm|mov|m4v|mp3)(?:\\?.*)?$/i, (route) => route.abort());
    state[routeKey] = true;
  } catch {
    state[routeKey] = false;
  }
}

try {
  await page.setViewportSize(${JSON.stringify(target.viewport)});
} catch {}

await page.goto(${JSON.stringify(target.url)}, {
  waitUntil: 'domcontentloaded',
  timeout: ${PAGE_TIMEOUT_MS},
});

try {
  await waitForPageLoad({ page, timeout: 12000, minWait: 600 });
} catch {}

try {
  await page.evaluate(async () => {
    const pending = Array.from(document.images).filter((image) => !image.complete);
    await Promise.allSettled(
      pending.map(
        (image) =>
          new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
            window.setTimeout(resolve, 3000);
          }),
      ),
    );
  });
} catch {}

await page.waitForTimeout(500);

const captureFallback = await page.evaluate(
  ${fallbackSource},
  ${fallbackStyle},
);

await page.waitForTimeout(captureFallback.applied ? 400 : 200);

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

await page.screenshot({
  path: ${JSON.stringify(screenshotPath)},
  scale: 'css',
  timeout: 120000,
});
await page.screenshot({
  path: ${JSON.stringify(fullPageScreenshotPath)},
  scale: 'css',
  fullPage: true,
  timeout: 120000,
});

fs.writeFileSync(
  ${JSON.stringify(resultPath)},
  JSON.stringify({ counts, captureFallback }, null, 2),
);
console.log('captured', ${JSON.stringify(target.name)});
`);

  await runPlaywriterEval(playwriter, sessionId, code);
  const result = JSON.parse(await fs.readFile(resultPath, 'utf8'));

  return {
    name: target.name,
    url: target.url,
    viewport: target.viewport,
    pairKey: target.pairKey,
    counts: result.counts,
    captureFallback: result.captureFallback,
    fullPageCapture: {
      totalHeight: result.counts.documentHeight,
      capturedHeight: result.counts.documentHeight,
      truncated: false,
    },
    screenshot: path.relative(ROOT, screenshotPath),
    fullPageScreenshot: path.relative(ROOT, fullPageScreenshotPath),
  };
}

async function captureInteractionChecksWithPlaywriter(playwriter, sessionId) {
  const resultPath = path.join(OUT_DIR, `local-interaction-checks-${DATE_TAG}.json`);
  const manifestoScreenshot = path.join(OUT_DIR, `local-manifesto-modal-${DATE_TAG}.png`);
  const carouselScreenshot = path.join(OUT_DIR, `local-carousel-modal-${DATE_TAG}.png`);
  const remoteScreenshot = path.join(OUT_DIR, `local-remote-state-${DATE_TAG}.png`);
  const fallbackStyle = JSON.stringify(CAPTURE_FALLBACK_STYLE);
  const fallbackSource = playwriterCaptureFallbackSource();
  const code = buildPlaywriterCode(`
if (!state.interactionPage || state.interactionPage.isClosed()) {
  state.interactionPage = await context.newPage();
}
const page = state.interactionPage;
page.setDefaultTimeout(${PAGE_TIMEOUT_MS});
await page.goto(${JSON.stringify(LOCAL_URL)}, {
  waitUntil: 'domcontentloaded',
  timeout: ${PAGE_TIMEOUT_MS},
});

try {
  await waitForPageLoad({ page, timeout: 12000, minWait: 600 });
} catch {}

await page.evaluate(
  ${fallbackSource},
  ${fallbackStyle},
);
await page.waitForTimeout(400);

const checks = [];

const manifestoButton = page.locator('.manifesto-btn').first();
await manifestoButton.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await manifestoButton.click({ noWaitAfter: true });
await page.waitForTimeout(700);
checks.push({
  check: 'manifesto modal opens',
  modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden'),
});
await page.screenshot({
  path: ${JSON.stringify(manifestoScreenshot)},
  scale: 'css',
  timeout: 120000,
});
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

const carouselCard = page.locator('.carousel-card--interactive').first();
await carouselCard.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await carouselCard.click({ noWaitAfter: true });
await page.waitForTimeout(700);
checks.push({
  check: 'carousel modal opens',
  modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden'),
  hash: await page.evaluate(() => window.location.hash),
});
await page.screenshot({
  path: ${JSON.stringify(carouselScreenshot)},
  scale: 'css',
  timeout: 120000,
});
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

const remoteThumb = page.locator('.remote-studio-thumb');
await remoteThumb.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await remoteThumb.click({ force: true, noWaitAfter: true });
await page.waitForTimeout(700);
checks.push({
  check: 'remote studio interaction responds',
  modalHidden: await page.locator('.ws3-modal-overlay').getAttribute('aria-hidden'),
  hash: await page.evaluate(() => window.location.hash),
});
await page.screenshot({
  path: ${JSON.stringify(remoteScreenshot)},
  scale: 'css',
  timeout: 120000,
});

fs.writeFileSync(${JSON.stringify(resultPath)}, JSON.stringify(checks, null, 2));
console.log('interaction checks saved');
`);

  await runPlaywriterEval(playwriter, sessionId, code);
  return JSON.parse(await fs.readFile(resultPath, 'utf8'));
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
    { threshold: 0.1 },
  );
  const diffPath = path.join(OUT_DIR, `${name}-diff.png`);
  await fs.writeFile(diffPath, PNG.sync.write(diffPng));

  return {
    width,
    height,
    mismatchPixels,
    mismatchRatio: Number((mismatchPixels / (width * height)).toFixed(6)),
    diffImage: path.relative(ROOT, diffPath),
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
    const fullPageDiff = await createImageDiff({
      name: `${pair.name}-full-${DATE_TAG}`,
      livePath: path.join(ROOT, live.fullPageScreenshot),
      localPath: path.join(ROOT, local.fullPageScreenshot),
    });

    diffs.push({
      pair: pair.name,
      viewportDiff,
      fullPageDiff,
    });
  }

  return diffs;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const playwriter = await resolvePlaywriterCommand();
  const sessionId = await createPlaywriterSession(playwriter);

  try {
    const results = [];
    for (const target of TARGETS) {
      results.push(await captureTargetWithPlaywriter(playwriter, sessionId, target));
    }

    const diffs = await createDiffs(results);
    let interactionChecks;
    try {
      interactionChecks = await captureInteractionChecksWithPlaywriter(playwriter, sessionId);
    } catch (error) {
      interactionChecks = [
        {
          check: 'interaction checks failed',
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      captureMode: 'playwriter',
      playwriterCommand: [playwriter.command, ...playwriter.baseArgs].join(' '),
      localUrl: LOCAL_URL,
      liveUrl: LIVE_URL,
      results,
      diffs,
      interactionChecks,
    };

    await fs.writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } finally {
    await deletePlaywriterSession(playwriter, sessionId);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
