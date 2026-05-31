// Replace the hero "Contact Us" button (cta-main) with "Our Works" → /our-works.
// Only targets cta-main, leaves cta-small (nav buttons) untouched.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

// Match the entire <a> for cta-main → /contact
// Then build a fresh tag pointing at /our-works with text "Our Works".
// Keep the same internal Webflow structure so styling stays identical.
const RE_HERO_CTA = /<a href="\/contact" button="" data-wf--cta-main--variant="base" class="cta-main w-inline-block"><div class="button-text-mask"><div button-text="" class="button-text">Contact Us<\/div><\/div><div button-bg="" class="button-bg"><\/div><\/a>/g;

const REPLACEMENT =
  '<a href="/our-works" button="" data-wf--cta-main--variant="base" class="cta-main w-inline-block">' +
  '<div class="button-text-mask"><div button-text="" class="button-text">Our Works</div></div>' +
  '<div button-bg="" class="button-bg"></div></a>';

let totalReplacements = 0;
const HITS = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.html$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      const matches = before.match(RE_HERO_CTA) || [];
      if (matches.length === 0) continue;
      const after = before.replace(RE_HERO_CTA, REPLACEMENT);
      fs.writeFileSync(p, after);
      HITS.push({
        file: path.relative(path.join(__dirname, ".."), p),
        count: matches.length,
      });
      totalReplacements += matches.length;
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS) console.log(`  ${h.file}  (${h.count})`);
console.log(`total: ${totalReplacements}`);
