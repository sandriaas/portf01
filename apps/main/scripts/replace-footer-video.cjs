// Swap home footer background video to local trimmed assets.
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

const NEW_POSTER = "/x29/local-assets/footer-video/footer-poster.jpg";
const NEW_MP4 = "/x29/local-assets/footer-video/footer.mp4";
const NEW_WEBM = "/x29/local-assets/footer-video/footer.webm";

// Pattern: existing footer video poster (Webflow uses entity-encoded url(...))
const POSTER_RE =
  /style="background-image:url\(&quot;[^&]+11322997-hd_1920_1080_60fps-poster-00001\.jpg&quot;\)"/;
const MP4_SRC_RE =
  /<source src="[^"]+11322997-hd_1920_1080_60fps-transcode\.mp4"[^/]*\/>/;
const WEBM_SRC_RE =
  /<source src="[^"]+11322997-hd_1920_1080_60fps-transcode\.webm"[^/]*\/>/;

let changed = 0;
const newPoster = `style="background-image:url(&quot;${NEW_POSTER}&quot;)"`;
if (POSTER_RE.test(html)) {
  html = html.replace(POSTER_RE, newPoster);
  changed++;
} else {
  console.warn("footer poster pattern NOT found");
}

const newMp4 = `<source src="${NEW_MP4}" data-wf-ignore="true"/>`;
if (MP4_SRC_RE.test(html)) {
  html = html.replace(MP4_SRC_RE, newMp4);
  changed++;
} else {
  console.warn("footer mp4 source pattern NOT found");
}

const newWebm = `<source src="${NEW_WEBM}" data-wf-ignore="true"/>`;
if (WEBM_SRC_RE.test(html)) {
  html = html.replace(WEBM_SRC_RE, newWebm);
  changed++;
} else {
  console.warn("footer webm source pattern NOT found");
}

fs.writeFileSync(FILE, html);
console.log(`footer swap: ${changed} replacements applied`);
