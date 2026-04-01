import { chromium } from "playwright";

const pages = {
  live: "https://www.x29.ai/",
  local: "http://127.0.0.1:3011/",
};

const browser = await chromium.launch({ headless: true });

try {
  for (const [label, url] of Object.entries(pages)) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const result = await page.evaluate(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const video = document.querySelector(".video-home-hero video");

      if (!(video instanceof HTMLVideoElement)) {
        return { missing: true };
      }

      for (let i = 0; i < 100 && !document.documentElement.className.includes("w-mod-ix3"); i += 1) {
        await wait(100);
      }

      if (!(Number.isFinite(video.readyState) && video.readyState >= 1)) {
        await Promise.race([
          new Promise((resolve) => {
            const done = () => resolve(undefined);
            video.addEventListener("loadedmetadata", done, { once: true });
            video.addEventListener("loadeddata", done, { once: true });
          }),
          wait(4000),
        ]);
      }

      try {
        video.currentTime = 0;
      } catch {}

      try {
        video.pause();
      } catch {}

      await Promise.race([
        new Promise((resolve) => {
          const done = () => resolve(undefined);
          video.addEventListener("seeked", done, { once: true });
          video.addEventListener("playing", done, { once: true });
        }),
        wait(300),
      ]);

      try {
        video.pause();
      } catch {}

      return {
        readyState: video.readyState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration,
        posterStyle: video.style.backgroundImage,
        currentSrc: video.currentSrc,
        width: video.getBoundingClientRect().width,
        height: video.getBoundingClientRect().height,
      };
    });

    console.log(label, JSON.stringify(result, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
