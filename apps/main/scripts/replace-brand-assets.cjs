// Replace x29 logo and favicon/og/twitter asset references with delveblue brand.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

// Map old asset basename → new asset path served from /public/x29/brand
const ASSET_MAP = {
  // Logo SVGs (used in nav and slider overlay)
  "68a07e8a8fa91f18409608b9_X29.ai-1-.svg": "/x29/brand/logo-full.svg",
  "68a07f99fb7309f19910cabf_X29.ai-4-.svg": "/x29/brand/logo-full.svg",
  "68a089522f8c8d775f35056f_X29.ai-5-.svg": "/x29/brand/logo.svg",
  // Favicon / apple-touch-icon (referenced in *.config.json iconHref/appleTouchIconHref)
  "68a515e1340749cb0c0109d5_Studio-40-x-40-px-1-.png":
    "/x29/brand/icons/favicon-96x96.png",
  "68a516087b3b640ec198a474_Studio-40-x-40-px-256-x-256-px-.png":
    "/x29/brand/icons/apple-touch-icon.png",
  // OG / twitter share image
  "68a14c66be603756ab6e3a6b_Image-17-8-2025-at-1.27-pm.jpeg":
    "/x29/brand/logo-full.png",
};

const REPLACEMENTS = Object.entries(ASSET_MAP);

function transform(text) {
  let out = text;
  let total = 0;
  for (const [needle, replacement] of REPLACEMENTS) {
    // Replace any URL containing this filename, picking up the leading path.
    // We strip the entire "/x29/cdn.prod.website-files.com/...{needle}" with replacement.
    const re = new RegExp(
      "/x29/cdn\\.prod\\.website-files\\.com/[^\"'\\s,]*?" +
        needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g",
    );
    const before = out;
    out = out.replace(re, replacement);
    if (before !== out) {
      const count = (before.match(re) || []).length;
      total += count;
    }
    // Also strip srcset entries that reference any -p-NNN. variants of the same
    // basename (Webflow's responsive sizes) since those won't exist anymore.
    const baseSans = needle.replace(/\.(png|jpe?g|svg|webp)$/i, "");
    const sizeRe = new RegExp(
      "/x29/cdn\\.prod\\.website-files\\.com/[^\"'\\s,]*?" +
        baseSans.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "-p-\\d+\\.(png|jpe?g|svg|webp)\\s\\d+w(?:,\\s*)?",
      "g",
    );
    out = out.replace(sizeRe, "");
  }
  return { out, total };
}

const HITS = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json|md)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      const { out, total } = transform(before);
      if (out !== before) {
        fs.writeFileSync(p, out);
        HITS.push({ file: path.relative(path.join(__dirname, ".."), p), replacements: total });
      }
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS) console.log(`  ${h.file}  (${h.replacements} refs)`);
console.log(`total files: ${HITS.length}`);
