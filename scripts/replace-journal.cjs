// Rebuild the home journal slider to exactly 4 distinct cards using
// /x29/local-assets/journal/{1.jpg,2.jpg,3.jpeg,4.jpg}.
// 4th card duplicates 3rd card's blog post (title + link), per user request.
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

const POSTS = [
  {
    href: "/blog/engineering-the-ai-native-enterprise",
    title: "Engineering the AI-Native Enterprise",
    sub: "Our Heritage: Inspired by the Grumman X-29",
    img: "/x29/local-assets/journal/1.jpg",
    small: false,
  },
  {
    href: "/blog/the-x-29-lesson",
    title: "The X-29 Lesson",
    sub: "What an experimental jet teaches modern AI strategy",
    img: "/x29/local-assets/journal/2.jpg",
    small: true,
  },
  {
    href: "/blog/the-ai-native-operating-model",
    title: "The AI-Native Operating Model",
    sub: "Reorganizing the firm around augmented decision-making",
    img: "/x29/local-assets/journal/3.jpeg",
    small: false,
  },
  {
    href: "/blog/the-ai-native-operating-model",
    title: "The AI-Native Operating Model",
    sub: "Reorganizing the firm around augmented decision-making",
    img: "/x29/local-assets/journal/4.jpg",
    small: false,
  },
];

const buildSlide = (p) => {
  const wrapClass = p.small ? "image-wrap-blog small" : "image-wrap-blog";
  return (
    `<div class="slide-blog w-slide">` +
      `<div class="article w-dyn-list">` +
        `<div role="list" class="w-dyn-items">` +
          `<div role="listitem" class="w-dyn-item">` +
            `<a href="${p.href}" class="card-blog w-inline-block">` +
              `<div class="${wrapClass}">` +
                `<img src="${p.img}" loading="lazy" alt="" class="image-cover"/>` +
              `</div>` +
              `<div class="text-wrap-blog-card">` +
                `<div class="text-medium">${p.title}</div>` +
                `<div class="text-light-32">${p.sub}</div>` +
              `</div>` +
            `</a>` +
          `</div>` +
        `</div>` +
      `</div>` +
    `</div>`
  );
};

const newSlides = POSTS.map(buildSlide).join("");

// Find region: the slider mask wraps all slides.
const maskStart = html.indexOf('class="mask-blog w-slider-mask"');
if (maskStart < 0) throw new Error("mask-blog not found");
const openTagEnd = html.indexOf(">", maskStart) + 1;
// End: the first occurrence of slider-button-journal (the left arrow div) closes the mask wrapper.
const arrowIdx = html.indexOf("slider-button-journal", openTagEnd);
if (arrowIdx < 0) throw new Error("slider-button-journal not found");
// Walk back to the </div> that closes the mask
const closeMask = html.lastIndexOf("</div>", arrowIdx);
if (closeMask < 0) throw new Error("mask close </div> not found");

const before = html.slice(0, openTagEnd);
const after = html.slice(closeMask); // keep the closing </div> + nav arrows

html = before + newSlides + after;
fs.writeFileSync(FILE, html);

// quick verify
const reread = fs.readFileSync(FILE, "utf8");
const slideCount = (reread.match(/slide-blog w-slide/g) || []).length;
console.log(`journal slides now: ${slideCount}`);
const usedImgs = (reread.match(/\/x29\/local-assets\/journal\/[^"]+/g) || []);
console.log("journal imgs used:", usedImgs);
