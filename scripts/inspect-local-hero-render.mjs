// Inspects hero render state on local — poster/video opacity, dataset state, complaints
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

const consoleLogs = [];
page.on("console", (msg) =>
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`),
);
page.on("pageerror", (err) => consoleLogs.push(`[pageerror] ${err.message}`));
page.on("requestfailed", (req) =>
  consoleLogs.push(
    `[requestfailed] ${req.url()} -- ${req.failure()?.errorText}`,
  ),
);

await page.goto("http://localhost:3000/", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3500);

const data = await page.evaluate(() => {
  const wrapper = document.querySelector("[data-home-hero]");
  const video = document.getElementById("x29-home-hero-video");
  const poster = document.getElementById("x29-home-hero-poster");
  const styleVal = (el, k) => (el ? getComputedStyle(el)[k] : null);
  return {
    wrapperState: wrapper?.dataset?.homeHeroState ?? null,
    wrapperBg: styleVal(wrapper, "backgroundColor"),
    wrapperRect: wrapper?.getBoundingClientRect()?.toJSON(),
    poster: poster
      ? {
          src: poster.currentSrc || poster.src,
          complete: poster.complete,
          naturalWidth: poster.naturalWidth,
          naturalHeight: poster.naturalHeight,
          opacity: styleVal(poster, "opacity"),
          display: styleVal(poster, "display"),
          visibility: styleVal(poster, "visibility"),
          zIndex: styleVal(poster, "zIndex"),
          rect: poster.getBoundingClientRect().toJSON(),
        }
      : null,
    video: video
      ? {
          src: video.currentSrc || video.src,
          readyState: video.readyState,
          networkState: video.networkState,
          paused: video.paused,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          currentTime: video.currentTime,
          opacity: styleVal(video, "opacity"),
          display: styleVal(video, "display"),
          visibility: styleVal(video, "visibility"),
          zIndex: styleVal(video, "zIndex"),
          rect: video.getBoundingClientRect().toJSON(),
        }
      : null,
    htmlClass: document.documentElement.className,
    headlineVisibility: styleVal(
      document.querySelector(".headline-home-hero"),
      "visibility",
    ),
  };
});

console.log(JSON.stringify(data, null, 2));
console.log("\n--- console ---");
for (const line of consoleLogs.slice(0, 60)) console.log(line);

await ctx.close();
await browser.close();
