// Rewrite the homepage mirror's video references from same-origin
// `/pds-shop-design.myshopify.com/...mp4` to the public Backblaze B2 endpoint.
//
// Only the big video assets are offloaded to B2; images, models, fonts, draco,
// icons and JS/CSS chunks stay local in the Worker bundle and are left
// untouched here.
//
// The references live only in public/shopify-design/index.html. They appear in
// two forms inside that file:
//   - plain attribute:  "/pds-shop-design.myshopify.com/....mp4"
//   - escaped in JSON:   \"/pds-shop-design.myshopify.com/....mp4\"
// Both are handled by anchoring on the leading slash + host and matching up to
// the `.mp4` extension.
//
// Idempotent: already-absolute https URLs are not matched, so re-running is a
// no-op.
//
// Env overrides:
//   B2_BUCKET   bucket name (default "san001")
//   B2_PREFIX   key prefix  (default "app-gallery")

const fs = require("node:fs");
const path = require("node:path");

const BUCKET = process.env.B2_BUCKET ?? "san001";
const PREFIX = process.env.B2_PREFIX ?? "app-gallery";
const B2_BASE = `https://f001.backblazeb2.com/file/${BUCKET}/${PREFIX}`;

const TARGET = path.join(
  __dirname,
  "..",
  "public",
  "shopify-design",
  "index.html",
);

// Match a leading boundary char, then the same-origin video path, capturing the
// host-relative remainder up to and including `.mp4`. The boundary class
// excludes letters/`:` so an existing `https://.../pds-shop-design...` is not
// re-matched.
const RE =
  /([("'\s,=]|\\")\/(pds-shop-design\.myshopify\.com\/[^"'\s,)\\]+?\.mp4)/g;

if (!fs.existsSync(TARGET)) {
  console.error(`[rewrite:b2] ERROR: target not found: ${TARGET}`);
  process.exit(1);
}

const before = fs.readFileSync(TARGET, "utf8");
let count = 0;
const after = before.replace(RE, (_m, boundary, rest) => {
  count += 1;
  return `${boundary}${B2_BASE}/${rest}`;
});

if (count === 0) {
  console.log(
    "[rewrite:b2] No same-origin video references found (already rewritten?). No changes.",
  );
  process.exit(0);
}

fs.writeFileSync(TARGET, after);
console.log(
  `[rewrite:b2] Rewrote ${count} video reference(s) -> ${B2_BASE}/pds-shop-design.myshopify.com/...`,
);
console.log(
  `[rewrite:b2] File: ${path.relative(path.join(__dirname, ".."), TARGET)}`,
);
