#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const BUCKET_NAME = "oregea-media";
const DEFAULT_DEV_URL =
  process.env.HERO_BUCKET_DEV_URL ??
  "https://pub-a05e3eced20c4330baf5fb0f632f2d5f.r2.dev";
const DEFAULT_LANDSCAPE_SOURCE =
  "/home/sandriaas/Downloads/lv_0_20260422193147.mp4";
const DEFAULT_PORTRAIT_SOURCE =
  "/home/sandriaas/Downloads/lv_0_20260422194230.mp4";

const landscapeSource =
  process.env.HERO_LANDSCAPE_SOURCE ?? DEFAULT_LANDSCAPE_SOURCE;
const portraitSource =
  process.env.HERO_PORTRAIT_SOURCE ?? DEFAULT_PORTRAIT_SOURCE;
const optimizeMedia = process.env.HERO_SKIP_OPTIMIZE !== "1";

const heroVariants = [
  {
    key: "hero/home/landscape.mp4",
    name: "landscape",
    sourcePath: landscapeSource,
    width: 1280,
    height: 720,
    fps: 24,
    crf: 24,
    maxrate: "2500k",
    bufsize: "5000k",
    profile: "main",
    level: "4.0",
    sameOriginPath: "/x29/media/hero/home/landscape.mp4",
  },
  {
    key: "hero/home/portrait.mp4",
    name: "portrait",
    sourcePath: portraitSource,
    width: 720,
    height: 1280,
    fps: 24,
    crf: 24,
    maxrate: "1800k",
    bufsize: "3600k",
    profile: "main",
    level: "4.0",
    sameOriginPath: "/x29/media/hero/home/portrait.mp4",
  },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
  fail(
    "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required for hero media upload.",
  );
}

for (const filePath of [landscapeSource, portraitSource]) {
  if (!fs.existsSync(filePath)) {
    fail(`Missing hero media source: ${filePath}`);
  }
}

function runProcess(command, args, { allowFailure = false } = {}) {
  const maxAttempts = allowFailure ? 1 : 3;
  let result;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = spawnSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env,
    });

    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const combinedOutput = `${stdout}\n${stderr}`;
    const isTransientFailure =
      result.status !== 0 &&
      /502|503|504|bad gateway|timed out|malformed response|internal error|fetch failed/i.test(
        combinedOutput,
      );

    if (result.status === 0 || !isTransientFailure || attempt === maxAttempts) {
      break;
    }
  }

  if (!allowFailure && result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    fail(
      `${command} ${args.join(" ")} failed.\n${stderr || stdout || "No output."}`,
    );
  }

  return result;
}

function runWrangler(args, { allowFailure = false } = {}) {
  return runProcess("npx", ["wrangler", ...args], { allowFailure });
}

function ensureBucket() {
  const listResult = runWrangler(["r2", "bucket", "list"], { allowFailure: true });

  if (listResult.status !== 0) {
    return false;
  }

  if (listResult.stdout.includes(`name:           ${BUCKET_NAME}`)) {
    return true;
  }

  const createResult = runWrangler(["r2", "bucket", "create", BUCKET_NAME], {
    allowFailure: true,
  });

  return createResult.status === 0;
}

function ensureDevUrl() {
  let infoResult = runWrangler(
    ["r2", "bucket", "dev-url", "get", BUCKET_NAME],
    { allowFailure: true },
  );

  if (
    infoResult.status !== 0 ||
    infoResult.stdout.toLowerCase().includes("not enabled") ||
    infoResult.stdout.toLowerCase().includes("disabled")
  ) {
    runWrangler(["r2", "bucket", "dev-url", "enable", BUCKET_NAME], {
      allowFailure: true,
    });
    infoResult = runWrangler(["r2", "bucket", "dev-url", "get", BUCKET_NAME], {
      allowFailure: true,
    });
  }

  const match = infoResult.stdout.match(/https:\/\/[^\s']+\.r2\.dev/);

  return match ? match[0] : DEFAULT_DEV_URL;
}

function uploadObject(key, filePath) {
  runWrangler([
    "r2",
    "object",
    "put",
    `${BUCKET_NAME}/${key}`,
    "--remote",
    "--file",
    path.resolve(filePath),
    "--content-type",
    "video/mp4",
    "--cache-control",
    "public, max-age=31536000, immutable",
  ]);
}

function optimizeVideo({
  sourcePath,
  name,
  width,
  height,
  fps,
  crf,
  maxrate,
  bufsize,
  profile,
  level,
}) {
  const outputPath = path.join(os.tmpdir(), `oregea-home-hero-${name}.mp4`);

  if (!optimizeMedia) {
    return {
      outputPath: path.resolve(sourcePath),
      optimized: false,
    };
  }

  runProcess("ffmpeg", [
    "-y",
    "-i",
    path.resolve(sourcePath),
    "-vf",
    `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps},format=yuv420p`,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    String(crf),
    "-maxrate",
    maxrate,
    "-bufsize",
    bufsize,
    "-movflags",
    "+faststart",
    "-profile:v",
    profile,
    "-level:v",
    level,
    outputPath,
  ]);

  return {
    outputPath,
    optimized: true,
  };
}

ensureBucket();
const devUrl = ensureDevUrl();

const uploadedObjects = heroVariants.map((variant) => {
  const optimized = optimizeVideo(variant);
  uploadObject(variant.key, optimized.outputPath);

  return {
    name: variant.name,
    sourcePath: path.resolve(variant.sourcePath),
    sourceBytes: fs.statSync(variant.sourcePath).size,
    uploadedPath: optimized.outputPath,
    uploadedBytes: fs.statSync(optimized.outputPath).size,
    optimized: optimized.optimized,
    sameOriginUrl: variant.sameOriginPath,
    r2Url: `${devUrl}/${variant.key}`,
  };
});

console.log(
  JSON.stringify(
    {
      bucketName: BUCKET_NAME,
      devUrl,
      landscapeMp4Url: "/x29/media/hero/home/landscape.mp4",
      portraitMp4Url: "/x29/media/hero/home/portrait.mp4",
      uploads: uploadedObjects,
    },
    null,
    2,
  ),
);
