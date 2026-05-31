#!/usr/bin/env node

// Upload BIG assets (videos only) to Backblaze B2 bucket `san001` under the
// `app-gallery/` prefix using the configured rclone remote (default `b2`).
//
// Only the Shopify video directory is offloaded (282MB / 61 mp4 = ~85% of
// public/). Everything else stays local in the Cloudflare Worker bundle.
//
// Requirements:
//   - rclone installed and a remote configured (see `rclone config`).
//     Endpoint: s3.us-west-001.backblazeb2.com, bucket: san001 (public).
//
// Env overrides:
//   B2_REMOTE   rclone remote name (default "b2")
//   B2_BUCKET   bucket name        (default "san001")
//   B2_PREFIX   key prefix         (default "app-gallery")

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REMOTE = process.env.B2_REMOTE ?? "b2";
const BUCKET = process.env.B2_BUCKET ?? "san001";
const PREFIX = process.env.B2_PREFIX ?? "app-gallery";

// Big-asset directories to offload. Each entry maps a local dir under public/
// to its destination key (preserving the host-name folder layout).
const UPLOADS = [
  {
    localDir: "public/pds-shop-design.myshopify.com",
    destName: "pds-shop-design.myshopify.com",
  },
];

function fail(message) {
  console.error(`\n[upload:b2] ERROR: ${message}`);
  process.exit(1);
}

// Verify rclone is available.
const which = spawnSync("rclone", ["version"], { encoding: "utf8" });
if (which.status !== 0) {
  fail("rclone is not installed or not on PATH.");
}

// Verify the remote exists.
const remotes = spawnSync("rclone", ["listremotes"], { encoding: "utf8" });
if (remotes.status !== 0 || !remotes.stdout.includes(`${REMOTE}:`)) {
  fail(
    `rclone remote "${REMOTE}:" not found. Configure it with \`rclone config\` ` +
      `(S3 provider, endpoint s3.us-west-001.backblazeb2.com).`,
  );
}

let totalFiles = 0;
let totalBytes = 0;

for (const { localDir, destName } of UPLOADS) {
  const absLocal = path.join(ROOT, localDir);
  if (!fs.existsSync(absLocal)) {
    fail(`Local directory missing: ${localDir}`);
  }

  const dest = `${REMOTE}:${BUCKET}/${PREFIX}/${destName}`;

  // Count what we're about to push (for the summary).
  let dirFiles = 0;
  let dirBytes = 0;
  const stack = [absLocal];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const p = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else {
        dirFiles += 1;
        dirBytes += fs.statSync(p).size;
      }
    }
  }

  console.log(`\n[upload:b2] ${localDir}`);
  console.log(
    `[upload:b2]   -> ${dest}  (${dirFiles} files, ${(dirBytes / 1048576).toFixed(1)} MB)`,
  );

  const result = spawnSync(
    "rclone",
    [
      "copy",
      absLocal,
      dest,
      "--s3-no-check-bucket",
      "--header-upload",
      "Cache-Control: public, max-age=31536000, immutable",
      "--transfers",
      "8",
      "--checkers",
      "16",
      "--checksum",
      "--progress",
      "--stats-one-line",
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    fail(`rclone copy failed for ${localDir} (exit ${result.status}).`);
  }

  totalFiles += dirFiles;
  totalBytes += dirBytes;
}

const publicBase = `https://f001.backblazeb2.com/file/${BUCKET}/${PREFIX}`;
console.log(
  `\n[upload:b2] DONE. Uploaded ${totalFiles} files, ` +
    `${(totalBytes / 1048576).toFixed(1)} MB.`,
);
console.log(`[upload:b2] Public base: ${publicBase}`);
console.log(
  `[upload:b2] Next: run \`npm run rewrite:b2\` to repoint index.html at B2.`,
);
