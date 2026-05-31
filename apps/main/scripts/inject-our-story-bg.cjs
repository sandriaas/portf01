// Inject a scoped <style> block at the start of home.body.html that overrides
// the vendored Webflow CSS rule .section.home-video-section { background-image: ... }
// to use the local /x29/local-assets/our-story/big_hero_image.jpg.
const fs = require("node:fs");
const path = require("node:path");

const FILE = path.join(
  __dirname,
  "..",
  "src",
  "content",
  "x29",
  "pages",
  "home.body.html",
);
let html = fs.readFileSync(FILE, "utf8");

const MARKER = "<!-- x29-our-story-bg-override -->";
if (html.includes(MARKER)) {
  console.log("override already present; skipping insert");
} else {
  const STYLE =
    `${MARKER}<style>` +
    `.section.home-video-section{` +
      `background-image:url("/x29/local-assets/our-story/big_hero_image.jpg") !important;` +
      `background-position:50% 50%;` +
      `background-size:cover;` +
      `background-repeat:no-repeat;` +
    `}` +
    `</style>`;
  html = STYLE + html;
  fs.writeFileSync(FILE, html);
  console.log("inserted our-story bg override");
}
