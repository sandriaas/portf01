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
const DATE_TAG = '2026-04-09';
const LIVE_URL = 'https://shopify.design/';
const LOCAL_URL = process.env.SHOPIFY_LOCAL_URL ?? 'http://127.0.0.1:3005/';
const OUT_DIR = path.join(ROOT, 'docs', 'design-references', 'shopify.design', 'intro-sequence');
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'research',
  'shopify.design',
  `intro-sequence-${DATE_TAG}.json`,
);
const VIEWPORT = {
  width: Number(process.env.SHOPIFY_INTRO_WIDTH ?? 1440),
  height: Number(process.env.SHOPIFY_INTRO_HEIGHT ?? 1600),
};
const FRAME_COUNT = Number(process.env.SHOPIFY_INTRO_FRAMES ?? 30);
const FRAME_INTERVAL_MS = Number(process.env.SHOPIFY_INTRO_INTERVAL_MS ?? 200);

function padFrame(index) {
  return String(index).padStart(3, '0');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function runCommand(command, args) {
  await execFileAsync(command, args, {
    cwd: ROOT,
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function toMp4(framesPattern, outputPath, fps) {
  await runCommand('ffmpeg', [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    framesPattern,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    outputPath,
  ]);
}

function collectIntroState(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.layout-root');
    const headline = document.querySelector('.hero .wr');
    const header = document.querySelector('.site-header');
    const hero = document.querySelector('.hero');

    const styleSnapshot = (element) => {
      if (!element) return null;
      const computed = getComputedStyle(element);
      return {
        opacity: computed.opacity,
        transform: computed.transform,
        clipPath: computed.clipPath,
        top: computed.top,
        color: computed.color,
      };
    };

    return {
      title: document.title,
      rootClass: root?.className ?? null,
      headline: styleSnapshot(headline),
      header: styleSnapshot(header),
      hero: styleSnapshot(hero),
      modalHidden: document.querySelector('.ws3-modal-overlay')?.getAttribute('aria-hidden') ?? null,
      readyState: document.readyState,
      scrollY: window.scrollY,
    };
  });
}

async function captureSequence({ name, url }) {
  const sequenceDir = path.join(OUT_DIR, name);
  await ensureDir(sequenceDir);
  await fs.rm(sequenceDir, { recursive: true, force: true });
  await ensureDir(sequenceDir);

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(60_000);

    const frames = [];
    const navigationStartedAt = Date.now();
    const navigation = page.goto(url, { waitUntil: 'domcontentloaded' }).catch((error) => error);

    for (let index = 0; index < FRAME_COUNT; index += 1) {
      const targetElapsed = index * FRAME_INTERVAL_MS;
      const remainingDelay = targetElapsed - (Date.now() - navigationStartedAt);
      if (remainingDelay > 0) {
        await page.waitForTimeout(remainingDelay);
      }

      const pngPath = path.join(sequenceDir, `frame-${padFrame(index)}.png`);
      await page.screenshot({
        path: pngPath,
        scale: 'css',
        animations: 'allow',
        caret: 'hide',
      });

      frames.push({
        index,
        atMs: index * FRAME_INTERVAL_MS,
        png: path.relative(ROOT, pngPath),
        state: await collectIntroState(page),
      });
    }

    await navigation;

    await page.close();
    await context.close();

    const mp4Path = path.join(OUT_DIR, `${name}-${DATE_TAG}.mp4`);
    await toMp4(
      path.join(sequenceDir, 'frame-%03d.png'),
      mp4Path,
      Math.round(1000 / FRAME_INTERVAL_MS),
    );

    return {
      name,
      url,
      viewport: VIEWPORT,
      frameCount: FRAME_COUNT,
      frameIntervalMs: FRAME_INTERVAL_MS,
      frames,
      video: path.relative(ROOT, mp4Path),
    };
  } finally {
    await browser.close();
  }
}

function cropToSharedSize(first, second) {
  const width = Math.min(first.width, second.width);
  const height = Math.min(first.height, second.height);
  const firstCropped = new PNG({ width, height });
  const secondCropped = new PNG({ width, height });
  PNG.bitblt(first, firstCropped, 0, 0, width, height, 0, 0);
  PNG.bitblt(second, secondCropped, 0, 0, width, height, 0, 0);
  return { width, height, firstCropped, secondCropped };
}

async function compareSequences(live, local) {
  const comparisons = [];
  const totalFrames = Math.min(live.frames.length, local.frames.length);

  for (let index = 0; index < totalFrames; index += 1) {
    const liveFrame = live.frames[index];
    const localFrame = local.frames[index];
    const [liveBuffer, localBuffer] = await Promise.all([
      fs.readFile(path.join(ROOT, liveFrame.png)),
      fs.readFile(path.join(ROOT, localFrame.png)),
    ]);
    const livePng = PNG.sync.read(liveBuffer);
    const localPng = PNG.sync.read(localBuffer);
    const { width, height, firstCropped, secondCropped } = cropToSharedSize(livePng, localPng);
    const diff = new PNG({ width, height });
    const mismatchPixels = pixelmatch(
      firstCropped.data,
      secondCropped.data,
      diff.data,
      width,
      height,
      { threshold: 0.1, includeAA: false },
    );
    const diffPath = path.join(OUT_DIR, `diff-frame-${padFrame(index)}-${DATE_TAG}.png`);
    await fs.writeFile(diffPath, PNG.sync.write(diff));
    comparisons.push({
      index,
      atMs: liveFrame.atMs,
      mismatchPixels,
      mismatchRatio: Number((mismatchPixels / (width * height)).toFixed(6)),
      diff: path.relative(ROOT, diffPath),
      liveState: liveFrame.state,
      localState: localFrame.state,
    });
  }

  return comparisons;
}

async function main() {
  await ensureDir(OUT_DIR);

  const live = await captureSequence({ name: 'live-intro', url: LIVE_URL });
  const local = await captureSequence({ name: 'local-intro', url: LOCAL_URL });
  const comparisons = await compareSequences(live, local);

  const worstFrame = comparisons.reduce((worst, current) => {
    if (!worst || current.mismatchRatio > worst.mismatchRatio) {
      return current;
    }
    return worst;
  }, null);

  const payload = {
    generatedAt: new Date().toISOString(),
    live,
    local,
    comparisons,
    worstFrame,
  };

  await fs.writeFile(REPORT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
