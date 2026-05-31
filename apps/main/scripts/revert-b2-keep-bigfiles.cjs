// Revert prior B2 mass-rewrite: convert https://f001.backblazeb2.com/file/san001/x29/...
// back to /x29/... paths EXCEPT for the 3 oversize files that exceed the 25 MiB
// Cloudflare Worker asset cap (kept on B2).
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");
const B2_PREFIX = "https://f001.backblazeb2.com/file/san001";

// Files we KEEP on B2 (over CF Worker 25 MiB cap, or close to it).
const KEEP_ON_B2 = new Set([
  "/x29/media/hero/home/minima-manifesto.mp4",
  "/x29/media/hero/home/minima-manifesto.webm",
  "/x29/local-assets/footer-video/footer.mp4",
  "/x29/local-assets/footer-video/footer.webm",
]);

let totalReverts = 0;
let totalKeeps = 0;
const HITS = [];

function transform(text) {
  let reverts = 0;
  let keeps = 0;
  // Match the B2 URL we wrote earlier and capture the /x29/<rest> tail.
  const re = new RegExp(
    `${B2_PREFIX.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}(/x29/[^"'\\s,)?]+)`,
    "g",
  );
  const out = text.replace(re, (m, x29path) => {
    if (KEEP_ON_B2.has(x29path)) {
      keeps++;
      return m; // keep B2 URL
    }
    reverts++;
    return x29path; // back to local path
  });
  return { out, reverts, keeps };
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      const { out, reverts, keeps } = transform(before);
      if (out !== before) {
        fs.writeFileSync(p, out);
        HITS.push({
          file: path.relative(path.join(__dirname, ".."), p),
          reverts,
          keeps,
        });
        totalReverts += reverts;
        totalKeeps += keeps;
      }
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS)
  console.log(`  ${h.file}  (reverted ${h.reverts}, kept on B2 ${h.keeps})`);
console.log(
  `\ntotal files: ${HITS.length}, total reverted: ${totalReverts}, kept on B2: ${totalKeeps}`,
);
