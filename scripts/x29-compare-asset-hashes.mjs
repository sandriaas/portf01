import { chromium } from "playwright";

const targets = [
  {
    name: "hero-video",
    selector: ".video-home-hero video source[src$='.mp4']",
    attr: "src",
  },
  {
    name: "overlap-image",
    selector: ".home-overlap-section .slide-images:first-child img.image-cover",
    attr: "currentSrc",
  },
];

const pages = {
  live: "https://www.x29.ai/",
  local: "http://127.0.0.1:3011/",
};

const browser = await chromium.launch({ headless: true });

const digestHex = async (buffer) => {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
};

try {
  for (const [label, url] of Object.entries(pages)) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    const results = [];

    for (const target of targets) {
      const result = await page.evaluate(async (input) => {
        const element = document.querySelector(input.selector);

        if (!(element instanceof Element)) {
          return { ...input, missing: true };
        }

        const rawUrl =
          input.attr === "currentSrc" && element instanceof HTMLImageElement
            ? element.currentSrc
            : element.getAttribute(input.attr);

        if (!rawUrl) {
          return { ...input, missing: true };
        }

        const resolvedUrl = new URL(rawUrl, window.location.href).href;
        const response = await fetch(resolvedUrl);
        const buffer = await response.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        const hash = [...new Uint8Array(hashBuffer)]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");

        return {
          ...input,
          url: resolvedUrl,
          ok: response.ok,
          status: response.status,
          bytes: buffer.byteLength,
          hash,
        };
      }, target);

      results.push(result);
    }

    console.log(label, JSON.stringify(results, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
