#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUCKET_NAME = "oregea-media";
const DEFAULT_LANDSCAPE_SOURCE =
  "/home/sandriaas/Downloads/compose_video_1776851666830.mp4";
const DEFAULT_PORTRAIT_SOURCE =
  "/home/sandriaas/Downloads/compose_video_1776847743640.mp4";

const landscapeSource =
  process.env.HERO_LANDSCAPE_SOURCE ?? DEFAULT_LANDSCAPE_SOURCE;
const portraitSource =
  process.env.HERO_PORTRAIT_SOURCE ?? DEFAULT_PORTRAIT_SOURCE;

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

function runWrangler(args, { allowFailure = false } = {}) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });

  if (!allowFailure && result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    fail(
      `wrangler ${args.join(" ")} failed.\n${stderr || stdout || "No output."}`,
    );
  }

  return result;
}

function ensureBucket() {
  const listResult = runWrangler(["r2", "bucket", "list"]);

  if (listResult.stdout.includes(`name:           ${BUCKET_NAME}`)) {
    return;
  }

  runWrangler(["r2", "bucket", "create", BUCKET_NAME]);
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
    runWrangler(["r2", "bucket", "dev-url", "enable", BUCKET_NAME]);
    infoResult = runWrangler(["r2", "bucket", "dev-url", "get", BUCKET_NAME]);
  }

  const match = infoResult.stdout.match(/https:\/\/[^\s']+\.r2\.dev/);

  if (!match) {
    fail(`Unable to determine r2.dev URL for ${BUCKET_NAME}.`);
  }

  return match[0];
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

ensureBucket();
const devUrl = ensureDevUrl();

uploadObject("hero/home/landscape.mp4", landscapeSource);
uploadObject("hero/home/portrait.mp4", portraitSource);

console.log(
  JSON.stringify(
    {
      bucketName: BUCKET_NAME,
      devUrl,
      landscapeMp4Url: `${devUrl}/hero/home/landscape.mp4`,
      portraitMp4Url: `${devUrl}/hero/home/portrait.mp4`,
    },
    null,
    2,
  ),
);
