// Brand rename: X29.ai / X29.AI / X29.Ai / x29.ai → DelveBlue
// Grumman X-29 → DelveBlue
// X-29 → DelveBlue (standalone, where it refers to the jet)
// Skips href/src/url attribute VALUES (those are domain/file paths) unless they
// contain a human-readable phrase (rare). Skips JSON keys.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

// Order matters: longer phrases first.
const PHRASE_RULES = [
  [/Grumman X-29/g, "DelveBlue"],
  [/\bThe X-29 Lesson\b/g, "The DelveBlue Lesson"],
  [/\bX-29 Lesson\b/g, "DelveBlue Lesson"],
  [/\bthe X-29\b/g, "the DelveBlue"],
  [/\bX-29\b/g, "DelveBlue"],
  [/\bX29\.ai\b/g, "DelveBlue"],
  [/\bX29\.AI\b/g, "DelveBlue"],
  [/\bX29\.Ai\b/g, "DelveBlue"],
  [/\bx29\.ai\b/g, "DelveBlue"],
];

// Attribute values we never touch (domain refs, src paths, asset filenames).
const PROTECT_ATTR_VALUES = /\s(?:href|src|action|srcset|poster|data-(?:wf-[a-z-]+|video-url|poster-url))="[^"]*"/g;
// CSS url(...) tokens we never touch.
const PROTECT_CSS_URL = /url\((?:&quot;|"|')?[^"'()]*?(?:&quot;|"|')?\)/g;

function transform(text) {
  // Mask protected zones, transform, restore.
  const stash = [];
  let masked = text.replace(PROTECT_ATTR_VALUES, (m) => {
    stash.push(m);
    return `\u0000PROT${stash.length - 1}\u0001`;
  });
  masked = masked.replace(PROTECT_CSS_URL, (m) => {
    stash.push(m);
    return `\u0000PROT${stash.length - 1}\u0001`;
  });
  for (const [re, to] of PHRASE_RULES) {
    masked = masked.replace(re, to);
  }
  return masked.replace(/\u0000PROT(\d+)\u0001/g, (_m, i) => stash[Number(i)]);
}

const HITS = {};
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json|md)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      const after = transform(before);
      if (before !== after) {
        const diffCount = before.length - after.length;
        HITS[p] = { changed: true, charDelta: diffCount };
        fs.writeFileSync(p, after);
      }
    }
  }
}

walk(ROOT);

// also handle src/lib/x29-document.ts metadata URL twitter/og host swap? user didn't ask
// to change deployment URLs, so leave x29.ai canonical URL alone in og tags.

console.log("changed files:");
for (const [f, info] of Object.entries(HITS)) {
  console.log(`  ${path.relative(path.join(__dirname, ".."), f)}  Δlen=${info.charDelta}`);
}
console.log(`total: ${Object.keys(HITS).length}`);
