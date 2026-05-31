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
const DATE_TAG = process.env.SHOPIFY_INTRO_DATE_TAG ?? '2026-04-09';
const LOCAL_URL = process.env.SHOPIFY_LOCAL_URL ?? 'http://127.0.0.1:3005/';
const LIVE_URL = 'https://shopify.design/';
const VIEWPORT = {
  width: Number(process.env.SHOPIFY_INTRO_WIDTH ?? 1440),
  height: Number(process.env.SHOPIFY_INTRO_HEIGHT ?? 1200),
};
const FRAME_STEP_MS = Number(process.env.SHOPIFY_INTRO_FRAME_STEP_MS ?? 200);
const DURATION_MS = Number(process.env.SHOPIFY_INTRO_DURATION_MS ?? 7000);
const FPS = Math.max(1, Math.round(1000 / FRAME_STEP_MS));
const OUT_DIR = path.join(ROOT, 'docs', 'design-references', 'shopify.design', `intro-${DATE_TAG}`);
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'research',
  'shopify.design',
  `intro-parity-${DATE_TAG}.json`,
);
const TARGETS = [
  { name: 'live', url: LIVE_URL },
  { name: 'local', url: LOCAL_URL },
];
const FRAME_TIMES = Array.from(
  { length: Math.floor(DURATION_MS / FRAME_STEP_MS) + 1 },
  (_, index) => index * FRAME_STEP_MS,
);

function toRelativePath(filePath) {
  return path.relative(ROOT, filePath);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writePng(filePath, png) {
  await fs.writeFile(filePath, PNG.sync.write(png));
}

function cropToCommonSize(left, right) {
  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);
  const crop = (source) => {
    if (source.width === width && source.height === height) {
      return source;
    }

    const png = new PNG({ width, height });
    PNG.bitblt(source, png, 0, 0, width, height, 0, 0);
    return png;
  };

  return {
    width,
    height,
    left: crop(left),
    right: crop(right),
  };
}

function buildSideBySide(livePng, localPng) {
  const common = cropToCommonSize(livePng, localPng);
  const combined = new PNG({ width: common.width * 2, height: common.height });
  combined.data.fill(255);
  PNG.bitblt(common.left, combined, 0, 0, common.width, common.height, 0, 0);
  PNG.bitblt(common.right, combined, 0, 0, common.width, common.height, common.width, 0);
  return { png: combined, width: common.width, height: common.height };
}

async function createVideoFromFrames(inputPattern, outputPath) {
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      inputPattern,
      '-pix_fmt',
      'yuv420p',
      outputPath,
    ],
    {
      cwd: ROOT,
      maxBuffer: 32 * 1024 * 1024,
    },
  );
}

async function captureTargetSequence(target) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader',
    ],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.route(/\.(?:mp4|webm|mov|m4v|mp3)(?:\?.*)?$/i, (route) => route.abort());

  const traces = [];
  const errors = [];
  page.on('console', (message) => {
    const text = message.text();
    if (!text.startsWith('__INTRO_TRACE__')) {
      return;
    }
    try {
      traces.push(JSON.parse(text.slice('__INTRO_TRACE__'.length)));
    } catch {
      traces.push({ raw: text });
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  await page.addInitScript(() => {
    const traceStart = performance.now();
    const emit = (name, detail = {}) => {
      console.log(
        '__INTRO_TRACE__' +
          JSON.stringify({
            t: Math.round(performance.now() - traceStart),
            name,
            detail,
          }),
      );
    };

    document.addEventListener('readystatechange', () =>
      emit('ready-state', { state: document.readyState }),
    );
    window.addEventListener('load', () => emit('window-load'));
    window.addEventListener('site-ready', () => emit('site-ready'));
  });

  const framesDir = path.join(OUT_DIR, target.name);
  await ensureDir(framesDir);

  const captureStart = Date.now();
  await page.goto(target.url, { waitUntil: 'commit', timeout: 60_000 });

  const samples = [];

  for (const [index, at] of FRAME_TIMES.entries()) {
    const dueAt = captureStart + at;
    const waitMs = dueAt - Date.now();
    if (waitMs > 0) {
      await page.waitForTimeout(waitMs);
    }

    const framePath = path.join(framesDir, `${String(index).padStart(4, '0')}.png`);
    await page.screenshot({
      path: framePath,
      scale: 'css',
      animations: 'allow',
      caret: 'hide',
      timeout: 0,
    });

    let sample;
    try {
      sample = await page.evaluate((time) => {
        const root = document.querySelector('.layout-root');
        const selectStyle = (selector) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element) : null;
        };
        const overlay = Array.from(document.querySelectorAll('div')).find((element) => {
          const computed = getComputedStyle(element);
          return computed.position === 'fixed' && computed.zIndex === '99999';
        });
        const heroStyle = selectStyle('.hero');
        const headerStyle = selectStyle('.site-header');
        const liveBarStyle = selectStyle('.hero-live-bar');
        const firstCardStyle = selectStyle('.hero-grid-card');
        return {
          at: time,
          sampledAtMs: Math.round(performance.now()),
          rootClass: root?.className ?? null,
          overlayPresent: overlay != null,
          overlayOpacity: overlay ? getComputedStyle(overlay).opacity : null,
          heroAnimation: heroStyle?.animation ?? null,
          heroAnimationPlayState: heroStyle?.animationPlayState ?? null,
          heroTransform: heroStyle?.transform ?? null,
          headerAnimation: headerStyle?.animation ?? null,
          headerAnimationPlayState: headerStyle?.animationPlayState ?? null,
          headerOpacity: headerStyle?.opacity ?? null,
          liveBarAnimation: liveBarStyle?.animation ?? null,
          liveBarAnimationPlayState: liveBarStyle?.animationPlayState ?? null,
          liveBarOpacity: liveBarStyle?.opacity ?? null,
          firstCardAnimation: firstCardStyle?.animation ?? null,
          firstCardAnimationPlayState: firstCardStyle?.animationPlayState ?? null,
          firstCardOpacity: firstCardStyle?.opacity ?? null,
          firstCardTransform: firstCardStyle?.transform ?? null,
        };
      }, at);
    } catch (error) {
      sample = {
        at,
        sampledAtMs: null,
        rootClass: null,
        overlayPresent: null,
        overlayOpacity: null,
        heroAnimation: null,
        heroAnimationPlayState: null,
        heroTransform: null,
        headerAnimation: null,
        headerAnimationPlayState: null,
        headerOpacity: null,
        liveBarAnimation: null,
        liveBarAnimationPlayState: null,
        liveBarOpacity: null,
        firstCardAnimation: null,
        firstCardAnimationPlayState: null,
        firstCardOpacity: null,
        firstCardTransform: null,
        evaluateError: error instanceof Error ? error.message : String(error),
      };
    }

    samples.push({
      ...sample,
      capturedAtMs: Math.max(0, Date.now() - captureStart),
      frame: toRelativePath(framePath),
    });
  }

  const finalUrl = page.url();

  await browser.close();

  return {
    target: target.name,
    url: target.url,
    viewport: VIEWPORT,
    finalUrl,
    traces,
    errors,
    framesDir: toRelativePath(framesDir),
    samples,
  };
}

function summarizeReveal(result) {
  const interactiveTrace = result.traces.find(
    (trace) => trace.name === 'ready-state' && trace.detail?.state === 'interactive',
  );
  const revealSample = result.samples.find((sample) => sample.rootClass === 'layout-root');
  if (!revealSample) {
    return {
      interactiveMs: interactiveTrace?.t ?? null,
      revealAfterInteractiveMs: null,
      revealAtCapturedMs: null,
      revealAtNavigationMs: null,
      revealFrame: null,
    };
  }

  return {
    interactiveMs: interactiveTrace?.t ?? null,
    revealAfterInteractiveMs: revealSample.at,
    revealAtCapturedMs: revealSample.capturedAtMs ?? null,
    revealAtMeasuredMs:
      interactiveTrace?.t != null ? interactiveTrace.t + revealSample.at : revealSample.at,
    revealAtNavigationMs: revealSample.sampledAtMs ?? null,
    revealFrame: revealSample.frame,
  };
}

async function createComparisonArtifacts(liveResult, localResult) {
  const compareDir = path.join(OUT_DIR, 'compare');
  const diffDir = path.join(OUT_DIR, 'diff');
  await Promise.all([ensureDir(compareDir), ensureDir(diffDir)]);

  const frameDiffs = [];

  for (let index = 0; index < FRAME_TIMES.length; index += 1) {
    const frameId = String(index).padStart(4, '0');
    const liveFramePath = path.join(ROOT, liveResult.samples[index].frame);
    const localFramePath = path.join(ROOT, localResult.samples[index].frame);
    const [liveBuffer, localBuffer] = await Promise.all([
      fs.readFile(liveFramePath),
      fs.readFile(localFramePath),
    ]);
    const livePng = PNG.sync.read(liveBuffer);
    const localPng = PNG.sync.read(localBuffer);
    const combined = buildSideBySide(livePng, localPng);
    const compareFramePath = path.join(compareDir, `${frameId}.png`);
    await writePng(compareFramePath, combined.png);

    const common = cropToCommonSize(livePng, localPng);
    const diffPng = new PNG({ width: common.width, height: common.height });
    const mismatchPixels = pixelmatch(
      common.left.data,
      common.right.data,
      diffPng.data,
      common.width,
      common.height,
      {
        threshold: 0.1,
        includeAA: false,
      },
    );
    const diffFramePath = path.join(diffDir, `${frameId}.png`);
    await writePng(diffFramePath, diffPng);

    frameDiffs.push({
      at: FRAME_TIMES[index],
      mismatchPixels,
      mismatchRatio: Number((mismatchPixels / (common.width * common.height)).toFixed(6)),
      compareFrame: toRelativePath(compareFramePath),
      diffFrame: toRelativePath(diffFramePath),
    });
  }

  const liveVideoPath = path.join(OUT_DIR, `live-intro-${DATE_TAG}.mp4`);
  const localVideoPath = path.join(OUT_DIR, `local-intro-${DATE_TAG}.mp4`);
  const compareVideoPath = path.join(OUT_DIR, `compare-intro-${DATE_TAG}.mp4`);
  const diffVideoPath = path.join(OUT_DIR, `diff-intro-${DATE_TAG}.mp4`);

  await createVideoFromFrames(path.join(ROOT, liveResult.framesDir, '%04d.png'), liveVideoPath);
  await createVideoFromFrames(path.join(ROOT, localResult.framesDir, '%04d.png'), localVideoPath);
  await createVideoFromFrames(path.join(compareDir, '%04d.png'), compareVideoPath);
  await createVideoFromFrames(path.join(diffDir, '%04d.png'), diffVideoPath);

  return {
    frameDiffs,
    liveVideo: toRelativePath(liveVideoPath),
    localVideo: toRelativePath(localVideoPath),
    compareVideo: toRelativePath(compareVideoPath),
    diffVideo: toRelativePath(diffVideoPath),
  };
}

async function main() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await ensureDir(OUT_DIR);

  const [liveResult, localResult] = await Promise.all(
    TARGETS.map((target) => captureTargetSequence(target)),
  );
  const comparison = await createComparisonArtifacts(liveResult, localResult);
  const liveSummary = summarizeReveal(liveResult);
  const localSummary = summarizeReveal(localResult);
  const worstFrame =
    comparison.frameDiffs.reduce((worst, frame) => {
      if (!worst || frame.mismatchRatio > worst.mismatchRatio) {
        return frame;
      }
      return worst;
    }, null) ?? null;

  const payload = {
    generatedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    frameStepMs: FRAME_STEP_MS,
    durationMs: DURATION_MS,
    fps: FPS,
    live: liveResult,
    local: localResult,
    comparison,
    summary: {
      live: liveSummary,
      local: localSummary,
      navigationDeltaMs:
        liveSummary.revealAtNavigationMs != null && localSummary.revealAtNavigationMs != null
          ? localSummary.revealAtNavigationMs - liveSummary.revealAtNavigationMs
          : null,
      capturedDeltaMs:
        liveSummary.revealAtCapturedMs != null && localSummary.revealAtCapturedMs != null
          ? localSummary.revealAtCapturedMs - liveSummary.revealAtCapturedMs
          : null,
      measuredDeltaMs:
        liveSummary.revealAtMeasuredMs != null && localSummary.revealAtMeasuredMs != null
          ? localSummary.revealAtMeasuredMs - liveSummary.revealAtMeasuredMs
          : null,
      interactiveDeltaMs:
        liveSummary.interactiveMs != null && localSummary.interactiveMs != null
          ? localSummary.interactiveMs - liveSummary.interactiveMs
          : null,
      worstFrame,
    },
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
