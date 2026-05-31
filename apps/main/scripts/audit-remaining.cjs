const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..", "src", "content");
const tally = {};
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|json)$/.test(e.name)) {
      const t = fs.readFileSync(p, "utf8");
      for (const m of t.matchAll(
        /\/x29\/cdn\.prod\.website-files\.com\/[^"\s,)]+\.(jpg|jpeg|png|webp|svg|mp4|webm)/g,
      )) {
        const base = m[0].split("/").pop();
        if (!tally[base]) tally[base] = { count: 0, pages: new Set() };
        tally[base].count++;
        tally[base].pages.add(path.basename(p));
      }
    }
  }
}
walk(ROOT);
const arr = Object.entries(tally).map(([k, v]) => ({
  k,
  count: v.count,
  pages: [...v.pages],
}));
arr.sort((a, b) => b.count - a.count);
console.log("=== top remaining Webflow assets (by ref count) ===");
arr.slice(0, 60).forEach((a) => {
  const isSrcset = !!a.k.match(/-p-\d+\./);
  console.log(
    "  " +
      String(a.count).padStart(3) +
      "  " +
      (isSrcset ? "[srcset]" : "        ") +
      "  " +
      a.k +
      "  [" +
      a.pages.length +
      " pages]",
  );
});
console.log("\nunique remaining basenames:", arr.length);
