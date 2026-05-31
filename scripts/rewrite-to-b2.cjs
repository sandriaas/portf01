// Rewrite all /x29/<path> references in body HTML and config JSON to the
// public Backblaze B2 endpoint. Skips x29-injected style markers (CSS-only).
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");
const B2 = "https://f001.backblazeb2.com/file/san001";

// Match /x29/... up to a quote, whitespace, or comma.
// We deliberately exclude /x29/media/hero/home/* because that's served by the
// dynamic Next route at src/app/x29/media/hero/home/[asset]/route.ts which
// proxies via R2/B2 with byte-range support. (We'll redirect that route to B2
// fallback in the lib.)
const RE = /(["'\s,(=])\/x29\/((?!media\/hero\/home\/)[^"'\s,)]+\.(?:jpg|jpeg|png|webp|svg|mp4|webm|ico|webmanifest))/g;

let totalReplacements = 0;
const HITS = [];

function transform(text) {
  let count = 0;
  const out = text.replace(RE, (m, prefix, rest) => {
    count++;
    return `${prefix}${B2}/x29/${rest}`;
  });
  return { out, count };
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      const { out, count } = transform(before);
      if (out !== before) {
        fs.writeFileSync(p, out);
        HITS.push({ file: path.relative(path.join(__dirname, ".."), p), count });
        totalReplacements += count;
      }
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS) console.log(`  ${h.file}  (${h.count} swaps)`);
console.log(`\ntotal files: ${HITS.length}, total swaps: ${totalReplacements}`);
