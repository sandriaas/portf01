const fs = require("node:fs");
const html = fs.readFileSync("src/content/x29/pages/home.body.html", "utf8");
let i = 0;
let count = 0;
while ((i = html.indexOf('href="/contact"', i + 1)) !== -1) {
  count++;
  const start = html.lastIndexOf("<a ", i);
  const end = html.indexOf("</a>", i) + 4;
  const tag = html.slice(start, end);
  if (tag.includes("cta-")) {
    console.log("=== match", count, "length", tag.length, "===");
    console.log(tag.slice(0, 500), "...", tag.slice(-200));
    console.log();
  }
}
