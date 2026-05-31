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
      for (let i = 0; i < 100 && !document.documentElement.className.includes("w-mod-ix3"); i += 1) {
        await wait(100);
      }

      const wrapper = document.querySelector(".video-home-hero");
      const video = wrapper?.querySelector("video");

      if (!(wrapper instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
        return { missing: true };
      }

      try {
        video.currentTime = 0;
        video.pause();
      } catch {}

      const wrapperRect = wrapper.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();
      const wrapperStyles = getComputedStyle(wrapper);
      const videoStyles = getComputedStyle(video);

      return {
        wrapperRect: {
          x: wrapperRect.x,
          y: wrapperRect.y,
          width: wrapperRect.width,
          height: wrapperRect.height,
        },
        videoRect: {
          x: videoRect.x,
          y: videoRect.y,
          width: videoRect.width,
          height: videoRect.height,
        },
        wrapperStyles: {
          width: wrapperStyles.width,
          height: wrapperStyles.height,
          position: wrapperStyles.position,
          inset: wrapperStyles.inset,
          overflow: wrapperStyles.overflow,
        },
        videoStyles: {
          width: videoStyles.width,
          height: videoStyles.height,
          minWidth: videoStyles.minWidth,
          minHeight: videoStyles.minHeight,
          maxWidth: videoStyles.maxWidth,
          maxHeight: videoStyles.maxHeight,
          objectFit: videoStyles.objectFit,
          objectPosition: videoStyles.objectPosition,
          transform: videoStyles.transform,
          inset: videoStyles.inset,
          position: videoStyles.position,
        },
        intrinsic: {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        },
      };
    });

    console.log(label, JSON.stringify(result, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
