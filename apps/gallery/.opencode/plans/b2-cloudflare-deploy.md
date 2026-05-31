# Plan: Deploy shopify clone to Cloudflare Workers with Backblaze B2 media offload

## Decisions (confirmed with user)
- ONLY big assets go to B2. "Big" = the videos only. Verified size distribution: only 70 files are ≥1MB and all the >2MB files are videos. Videos (`/pds-shop-design.myshopify.com`) = 282MB / 61 mp4 = 85% of public/. Everything else stays LOCAL in the Worker bundle.
- Keep LOCAL: cdn images (`/cdn.shopify.com/s` 27MB, largest 1.9MB), models (`/models/*.glb` 17MB), draco wasm, fonts woff2, oxygen JS/CSS chunks, icons, favicons, carousel, clock. After offload the Worker bundle ≈ 48MB with NO single file >25MB (Workers per-asset limit) → bundles cleanly.
- No CORS concern: videos load via `<video>`/`<source>`, which do not require CORS headers.
- Worker name: `delvebluegallery` (→ `delvebluegallery.<account-subdomain>.workers.dev`). Cloudflare project label: `DelveBlue-Gallery001`.
- Keep local media copies in `public/` (do NOT prune) — B2 URLs used at runtime, local stays as backup.
- Bump Next 16.2.3 → 16.2.4 to match verified x29 + OpenNext combo.

## B2 facts (verified)
- rclone remote `b2:` configured, endpoint `s3.us-west-001.backblazeb2.com`, region `us-west-001`.
- Bucket `san001` is public. Public friendly URL works: `https://f001.backblazeb2.com/file/san001/<key>` → HTTP 200.
- New project prefix: `app-gallery/` (x29 used `x29/`).
- Video filenames end in clean `.mp4`; referenced 61× in index.html only (NOT in JS chunks). On-disk paths match referenced URLs exactly (verified).

## Cloudflare creds (from shell env only; .env* gitignored; ROTATE after deploy)
- `CLOUDFLARE_ACCOUNT_ID=96d55ad87e6bb93a52d0d2728f0f093d`
- `CLOUDFLARE_API_TOKEN=cfat_...` (provided by user — treat as exposed, rotate)

## SECURITY: user pasted live Cloudflare API token + B2 keys in chat → rotate all after deploy.

---

## Files to change/create

### 1. package.json
- `dependencies.next`: `16.2.3` → `16.2.4`
- `devDependencies`: add `@opennextjs/cloudflare: 1.19.3`, `wrangler: 4.84.1`; `eslint-config-next` → `16.2.4`
- Add scripts:
  - `"upload:b2": "node scripts/upload-to-b2.mjs"`
  - `"rewrite:b2": "node scripts/rewrite-to-b2.cjs"`
  - `"cf:build": "opennextjs-cloudflare build"`
  - `"cf:preview": "npm run cf:build && opennextjs-cloudflare preview"`
  - `"cf:deploy": "npm run cf:build && opennextjs-cloudflare deploy"`
  - `"cf:typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"`

### 2. open-next.config.ts (new)
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```

### 3. next.config.ts (modify — KEEP existing `/` rewrite)
```ts
import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    void initOpenNextCloudflareForDev();
  });
}

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/shopify-design/index.html" },
      ],
    };
  },
};

export default nextConfig;
```

### 4. wrangler.jsonc (new)
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "delvebluegallery",
  "main": ".open-next/worker.js",
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "compatibility_date": "2026-04-22",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true }
}
```

### 5. .gitignore (append)
- `/.open-next/`
- `/.wrangler/`

### 6. scripts/upload-to-b2.mjs (new)
- Uses `rclone copy` with remote `b2:` to bucket `san001` under prefix `app-gallery/`.
- Dir to upload (BIG ASSETS / videos only):
  - `public/pds-shop-design.myshopify.com` → `b2:san001/app-gallery/pds-shop-design.myshopify.com`
- Flags: `--s3-no-check-bucket`, `--header-upload "Cache-Control: public, max-age=31536000, immutable"`, `--transfers 8`, `--checksum`, progress.
- Allow override of rclone remote name via env `B2_REMOTE` (default `b2`).

### 7. scripts/rewrite-to-b2.cjs (new — modeled on x29)
- Target file: `public/shopify-design/index.html` (only place pds video refs appear; verified none in JS chunks).
- B2 base: `https://f001.backblazeb2.com/file/san001/app-gallery`.
- Rewrite (handle both `"/path"` and escaped `\"/path\"` forms in the HTML):
  - `/pds-shop-design.myshopify.com/...mp4` → `${B2}/pds-shop-design.myshopify.com/...mp4`
- MUST NOT touch `/cdn.shopify.com/*` (images + scripts stay local), `/models/*`, `/fonts/*`, `/draco/*`, `/icons/*`.
- Idempotent: skip if already absolute (starts with `https://`). Print count of swaps (expect 61).

---

## Execution order
1. Edit package.json, next.config.ts, .gitignore; create open-next.config.ts, wrangler.jsonc, scripts/upload-to-b2.mjs, scripts/rewrite-to-b2.cjs.
2. `npm install`
3. `npm run upload:b2` (push ~282MB of videos to B2 app-gallery/)
4. Spot-check a B2 video URL returns 200.
5. `npm run rewrite:b2` (point index.html video refs at B2; expect 61 swaps)
6. `CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run cf:build`
7. `npm run cf:preview` smoke test (optional local)
8. `npm run cf:deploy`
9. Verify `https://delvebluegallery.<subdomain>.workers.dev`: homepage renders, videos stream from B2 (network tab → f001.backblazeb2.com), images/models/fonts load same-origin.
10. Remind user to rotate Cloudflare API token + B2 keys.

## Risks / notes
- index.html is the single rewrite target; re-running rewrite is idempotent. Keep a git backup before rewrite (git already tracks it).
- Worker bundle after offload ≈ 48MB (cdn images 27MB + models 17MB + draco/fonts/oxygen/icons ~4MB) — within limits; largest remaining file 2.7MB (a .glb), well under the 25MB Workers per-asset cap. Videos served from B2.
- `<video>` does not require CORS, so no B2 CORS config needed.
- `compatibility_date` mirrors x29 (2026-04-22); adjust if OpenNext 1.19.3 warns.
