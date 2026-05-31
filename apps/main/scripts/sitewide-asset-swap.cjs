// Sweep all remaining Webflow asset references on every page and remap them
// to the local /x29/local-assets/ files we already have. Strips srcset/sizes
// so multi-size variants don't 404. Leaves nav-icon SVGs (Menu, Close, Legal-Dots)
// alone since they're decorative UI glyphs, not brand-relevant.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "src", "content");

// Map: Webflow filename "stem" (everything matching, including srcset -p-NNN variants)
// → replacement local path. Order matters (longest stem first).
const MAP = [
  // ---- Footer video (highest priority) ----
  {
    re: /688b5122c3c8d6d8ccf865cf_11322997-hd_1920_1080_60fps-poster-00001\.jpg/g,
    to: "/x29/local-assets/footer-video/footer-poster.jpg",
    type: "url",
  },
  {
    re: /68a07b4456582bc42d1b4095_11322997-hd_1920_1080_60fps-transcode\.mp4/g,
    to: "/x29/local-assets/footer-video/footer.mp4",
    type: "url",
  },
  {
    re: /68a07b4456582bc42d1b4095_11322997-hd_1920_1080_60fps-transcode\.webm/g,
    to: "/x29/local-assets/footer-video/footer.webm",
    type: "url",
  },

  // ---- Sales menu thumbnails (each Webflow thumbnail → unique local image) ----
  // We use slider/we-are-for/what-we-do photos as page-card thumbnails.
  { stem: "68a07b4456582bc42d1b40f4_Home", to: "/x29/local-assets/slider/1.jpeg" },
  { stem: "68a07b4456582bc42d1b40df_About", to: "/x29/local-assets/our-story/big_hero_image.jpg" },
  { stem: "68a07b4456582bc42d1b40f3_Contact", to: "/x29/local-assets/we-are-for/2.jpg" },
  { stem: "68a07b4456582bc42d1b40f1_Projects", to: "/x29/local-assets/what-we-do/1.jpg" },
  { stem: "68a07b4456582bc42d1b40e0_Project", to: "/x29/local-assets/slider/4.jpg" },
  { stem: "68a07b4456582bc42d1b40f2_Article", to: "/x29/local-assets/journal/1.jpg" },
  { stem: "68a07b4456582bc42d1b40f5_404", to: "/x29/local-assets/slider/5.jpg" },
  { stem: "68a07b4456582bc42d1b40e1_Password", to: "/x29/local-assets/slider/6.jpg" },

  // ---- Blog card images (3 unique PNGs on 5 pages) ----
  { stem: "68a07b4456582bc42d1b408d_0e6107609ed36df7faea259f0849ce3b693d6642", to: "/x29/local-assets/journal/1.jpg" },
  { stem: "68a07b4456582bc42d1b4028_4527bf82a449a08ace2382486f6957b44f5c2eb2", to: "/x29/local-assets/journal/2.jpg" },
  { stem: "68a07b4456582bc42d1b406b_5d2249c6f5c46e64ac0f663c6784337c9d8fc70c", to: "/x29/local-assets/journal/3.jpeg" },

  // ---- Big article/about hero image ----
  { stem: "68a07b4456582bc42d1b3fdb_b78233390b8dda5eff2d15a0ac856116bedd29a0", to: "/x29/local-assets/our-story/big_hero_image.jpg" },

  // ---- Contact gallery images (used on contact + about + projects + we-are-for) ----
  { stem: "68a07b4456582bc42d1b40af_Contact-Image1", to: "/x29/local-assets/slider/3.jpg" },
  { stem: "68a07b4456582bc42d1b4006_Contact-Image1", to: "/x29/local-assets/slider/3.jpg" },
  { stem: "68a07b4456582bc42d1b40b3_Contact-Image2", to: "/x29/local-assets/slider/4.jpg" },
  { stem: "68a07b4456582bc42d1b3f26_Contact-Image2", to: "/x29/local-assets/slider/4.jpg" },
  { stem: "68a07b4456582bc42d1b40b0_Contact-Image3", to: "/x29/local-assets/slider/5.jpg" },
  { stem: "68a07b4456582bc42d1b40b2_Contact-Image4", to: "/x29/local-assets/slider/6.jpg" },
  { stem: "68a07b4456582bc42d1b40b4_Contact-Image5", to: "/x29/local-assets/slider/7.jpg" },
  { stem: "68a07b4456582bc42d1b40b1_Contact-Image6", to: "/x29/local-assets/slider/8.jpeg" },

  // ---- Project-Design.webp (services + slider) ----
  { stem: "68a07b4456582bc42d1b40b7_Project-Design", to: "/x29/local-assets/what-we-do/3.jpg" },
  { stem: "68a07b4456582bc42d1b40b8_Project-Design", to: "/x29/local-assets/what-we-do/4.jpg" },

  // ---- f8d31754 (our story bg) — already CSS-overridden on home, swap any leftover ----
  { stem: "68a07b4456582bc42d1b40d6_f8d31754713b29b071571b281e9f1967cd627e16", to: "/x29/local-assets/our-story/big_hero_image.jpg" },

  // ---- Inner-page secondary background videos (VR Immersion + Glowing Glass Rings) ----
  // Replace with the same trimmed footer.mp4/webm so we don't keep R2 fetches.
  { re: /688a59d234af41b40bc38520_VR-Immersion-Scene-poster-00001\.jpg/g, to: "/x29/local-assets/footer-video/footer-poster.jpg", type: "url" },
  { re: /68a07b4456582bc42d1b4090_VR-Immersion-Scene-transcode\.mp4/g, to: "/x29/local-assets/footer-video/footer.mp4", type: "url" },
  { re: /68a07b4456582bc42d1b4090_VR-Immersion-Scene-transcode\.webm/g, to: "/x29/local-assets/footer-video/footer.webm", type: "url" },
  { re: /688ba9546034525524e0973c_Glowing-Glass-Rings-poster-00001\.jpg/g, to: "/x29/local-assets/footer-video/footer-poster.jpg", type: "url" },
  { re: /68a07b4456582bc42d1b4097_Glowing-Glass-Rings-transcode\.mp4/g, to: "/x29/local-assets/footer-video/footer.mp4", type: "url" },
  { re: /68a07b4456582bc42d1b4097_Glowing-Glass-Rings-transcode\.webm/g, to: "/x29/local-assets/footer-video/footer.webm", type: "url" },

  // ---- Inner-page slider/article images ----
  { stem: "68a08575c88561e668566984_344070main_EC87-0182-14_full-1", to: "/x29/local-assets/slider/1.jpeg" },
  { stem: "68a1802a17cccfe17d42767d_344070main_EC87-0182-14_full-1", to: "/x29/local-assets/slider/1.jpeg" },
  { stem: "68a17cdeacdd78fdcc70a11a_190705151032-grumman-x-29-151028-f-dw547-002", to: "/x29/local-assets/slider/2.jpeg" },
  { stem: "68a085b095107d7afe0feb69_190705151032-grumman-x-29-151028-f-dw547-002", to: "/x29/local-assets/slider/2.jpeg" },
  { stem: "68a08620fe204e69d64b7832_nzta7teghdn21", to: "/x29/local-assets/slider/3.jpg" },
  { stem: "68a0864dd4607a59d28d759a_editor_images_1533199020815-Screen-Shot-2018-08-02-at-09.36.49", to: "/x29/local-assets/slider/4.jpg" },
  { stem: "68a17f992bddc5018d8cb4a8_editor_images_1533199020815-Screen-Shot-2018-08-02-at-09.36.49", to: "/x29/local-assets/slider/4.jpg" },

  // ---- Projects page hero ----
  { stem: "68a07b4456582bc42d1b3f02_67c82db8e5707cb06cd7436f1d0ca312f2014463", to: "/x29/local-assets/our-story/big_hero_image.jpg" },
];

// Build a regex to match any /x29/cdn.prod.website-files.com/.../<stem>(-p-NNN)?.<ext>
// Apply replacements in order; longer stems first so we don't shadow.
function buildStemReplacers() {
  const out = [];
  for (const item of MAP) {
    if (item.re) {
      // exact filename match (footer video). Replace just the basename within URL.
      // We replace any "/x29/cdn.prod.website-files.com/...<filename>" → item.to.
      const fullRe = new RegExp(
        "/x29/cdn\\.prod\\.website-files\\.com/[^\"'\\s,)]*?" +
          item.re.source.replace(/^\^|\$$/g, ""),
        "g",
      );
      out.push({ regex: fullRe, replacement: item.to, label: item.re.source });
      continue;
    }
    if (item.stem) {
      const stem = item.stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match the stem with optional -p-NNN size suffix and any extension.
      const fullRe = new RegExp(
        "/x29/cdn\\.prod\\.website-files\\.com/[^\"'\\s,)]*?" +
          stem +
          "(?:-p-\\d+)?\\.(?:jpg|jpeg|png|webp|svg)",
        "g",
      );
      out.push({ regex: fullRe, replacement: item.to, label: item.stem });
    }
  }
  return out;
}

const REPLACERS = buildStemReplacers();

function transform(text) {
  let out = text;
  let total = 0;
  for (const r of REPLACERS) {
    const before = out;
    out = out.replace(r.regex, r.replacement);
    if (before !== out) {
      const matches = before.match(r.regex);
      total += matches ? matches.length : 0;
    }
  }
  return { out, total };
}

// After replacing src, strip srcset+sizes attrs from any <img> whose src now points to /x29/local-assets/.
// This prevents stale -p-500.png 500w refs.
function stripSrcsetForLocalImgs(text) {
  return text.replace(
    /<img\s+([^>]*?)src="(\/x29\/local-assets\/[^"]+)"([^>]*?)\/>/g,
    (m, pre, src, post) => {
      const cleanedPre = pre
        .replace(/\ssrcset="[^"]*"/g, "")
        .replace(/\ssizes="[^"]*"/g, "");
      const cleanedPost = post
        .replace(/\ssrcset="[^"]*"/g, "")
        .replace(/\ssizes="[^"]*"/g, "");
      return `<img ${cleanedPre.trim()} src="${src}"${cleanedPost ? " " + cleanedPost.trim() : ""}/>`;
    },
  );
}

const HITS = [];
let totalReplacements = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(html|json)$/.test(ent.name)) {
      const before = fs.readFileSync(p, "utf8");
      let { out, total } = transform(before);
      out = stripSrcsetForLocalImgs(out);
      if (out !== before) {
        fs.writeFileSync(p, out);
        HITS.push({ file: path.relative(path.join(__dirname, ".."), p), total });
        totalReplacements += total;
      }
    }
  }
}

walk(ROOT);
console.log("changed files:");
for (const h of HITS) console.log(`  ${h.file}  (${h.total} url swaps)`);
console.log(`total files: ${HITS.length}, total url swaps: ${totalReplacements}`);
