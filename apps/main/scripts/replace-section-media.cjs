// One-shot transform of home.body.html to swap section media to local assets.
// Region-scoped: each section is sliced by its marker so shared Webflow
// filenames are only replaced inside the intended section.
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

const log = (...a) => console.log(...a);

function replaceImageCoversInRegion(startMarker, endMarker, newSrcs, label) {
  const s = html.indexOf(startMarker);
  if (s < 0) throw new Error(`start marker not found: ${startMarker}`);
  const e = endMarker ? html.indexOf(endMarker, s) : html.length;
  if (e < 0) throw new Error(`end marker not found: ${endMarker}`);
  let region = html.slice(s, e);

  let idx = 0;
  region = region.replace(
    /<img\s+src="[^"]*"([^>]*?)class="image-cover"\s*\/>/g,
    (full) => {
      if (idx >= newSrcs.length) {
        idx++;
        return full;
      }
      const src = newSrcs[idx];
      idx++;
      return `<img src="${src}" loading="lazy" alt="" class="image-cover"/>`;
    },
  );

  html = html.slice(0, s) + region + html.slice(e);
  log(`${label}: replaced ${Math.min(idx, newSrcs.length)} / saw ${idx}`);
}

const SLIDER = [
  "/x29/local-assets/slider/1.jpeg",
  "/x29/local-assets/slider/2.jpeg",
  "/x29/local-assets/slider/3.jpg",
  "/x29/local-assets/slider/4.jpg",
  "/x29/local-assets/slider/5.jpg",
  "/x29/local-assets/slider/6.jpg",
  "/x29/local-assets/slider/7.jpg",
  "/x29/local-assets/slider/8.jpeg",
];
const WEAREFOR = [
  "/x29/local-assets/we-are-for/1.jpg",
  "/x29/local-assets/we-are-for/2.jpg",
  "/x29/local-assets/we-are-for/3.jpg",
];
const WHATWEDO = [
  "/x29/local-assets/what-we-do/1.jpg",
  "/x29/local-assets/what-we-do/2.jpg",
  "/x29/local-assets/what-we-do/3.jpg",
  "/x29/local-assets/what-we-do/4.jpg",
  "/x29/local-assets/what-we-do/5.jpg",
  "/x29/local-assets/what-we-do/1.jpg",
  "/x29/local-assets/what-we-do/2.jpg",
  "/x29/local-assets/what-we-do/3.jpg",
  "/x29/local-assets/what-we-do/4.jpg",
  "/x29/local-assets/what-we-do/5.jpg",
];

// 1) Slider under the X-29 quote (overlap section) — first 8 slides only
replaceImageCoversInRegion(
  "slider-images w-slider",
  "w-slider-nav",
  SLIDER,
  "SLIDER",
);
// 2) Work project cards
replaceImageCoversInRegion(
  "home-work-section",
  "home-services-section",
  WEAREFOR,
  "WORK/we-are-for",
);
// 3) Services What-we-do
replaceImageCoversInRegion(
  "home-services-section",
  "home-video-section",
  WHATWEDO,
  "SERVICES/what-we-do",
);

fs.writeFileSync(FILE, html);
log("\nWROTE", FILE);
