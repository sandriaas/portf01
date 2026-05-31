// Remove .logo-circle-image overlays from slider images, and inject a CSS
// override that shrinks the footer logo. Idempotent.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

// 1) Remove the entire <div class="overlay-circle-image"><img class="logo-circle-image"/></div>
//    block since the user wants no logo over slider images.
//    Also handle a bare <img class="logo-circle-image"/> that lives outside an overlay div.
const OVERLAY_DIV_RE =
  /<div class="overlay-circle-image">\s*<img[^>]*class="logo-circle-image"[^>]*\/>\s*<\/div>/g;
const BARE_IMG_RE = /<img[^>]*class="logo-circle-image"[^>]*\/>/g;

// 2) Inject a scoped <style> at the top of each home/article body that shrinks .footer-logo.
//    Use a unique marker so re-runs don't duplicate.
const FOOTER_STYLE_MARKER = "<!-- x29-footer-logo-shrink -->";
const FOOTER_STYLE =
  `${FOOTER_STYLE_MARKER}<style>` +
  `.footer-logo{height:24px!important;width:auto!important;}` +
  `@media (min-width:1024px){.footer-logo{height:28px!important;}}` +
  `</style>`;

let files = 0;
let overlayRemovals = 0;
let bareRemovals = 0;
let styleInjections = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.html$/.test(ent.name)) {
      let text = fs.readFileSync(p, "utf8");
      const before = text;
      let oRem = (text.match(OVERLAY_DIV_RE) || []).length;
      text = text.replace(OVERLAY_DIV_RE, "");
      let bRem = (text.match(BARE_IMG_RE) || []).length;
      text = text.replace(BARE_IMG_RE, "");
      if (text.includes('class="footer-logo"') && !text.includes(FOOTER_STYLE_MARKER)) {
        text = FOOTER_STYLE + text;
        styleInjections++;
      }
      if (text !== before) {
        fs.writeFileSync(p, text);
        files++;
        overlayRemovals += oRem;
        bareRemovals += bRem;
      }
    }
  }
}

walk(ROOT);
console.log(
  `files changed: ${files}, overlay-divs removed: ${overlayRemovals}, bare imgs removed: ${bareRemovals}, footer-style injections: ${styleInjections}`,
);
