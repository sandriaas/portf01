// Normalize brand SVG sizing per class:
//   .logo-nav        → /x29/brand/logo.svg
//   .menu-logo       → /x29/brand/logo.svg
//   .logo-circle-image → /x29/brand/logo.svg
//   .footer-logo     → /x29/brand/logo-full.svg (unchanged)
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

const SMALL_CLASSES = new Set([
  "logo-nav",
  "menu-logo",
  "logo-circle-image",
]);

// Match an <img ...> tag with src on /x29/brand/(logo|logo-full).svg and a class attr.
const RE = /<img(\s+[^>]*?)src="\/x29\/brand\/(logo|logo-full)\.svg"([^>]*?)class="([^"]+)"([^>]*)\/>/g;

let total = 0;
const HITS = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      let count = 0;
      const after = before.replace(RE, (m, a, current, b, classes, c) => {
        const classList = classes.split(/\s+/);
        const wantsSmall = classList.some((cl) => SMALL_CLASSES.has(cl));
        const target = wantsSmall ? "logo" : "logo-full";
        if (target === current) return m;
        count++;
        return `<img${a}src="/x29/brand/${target}.svg"${b}class="${classes}"${c}/>`;
      });
      if (count > 0) {
        fs.writeFileSync(p, after);
        HITS.push({ file: path.relative(path.join(__dirname, ".."), p), count });
        total += count;
      }
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS) console.log(`  ${h.file}  (${h.count})`);
console.log(`total swaps: ${total}`);
