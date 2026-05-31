import { chromium } from "playwright";

const urls = {
  live: "https://www.x29.ai/",
  local: "http://127.0.0.1:3011/",
};
const viewport = {
  width: Number.parseInt(process.env.X29_VIEWPORT_WIDTH ?? "1440", 10),
  height: Number.parseInt(process.env.X29_VIEWPORT_HEIGHT ?? "900", 10),
};

const freezeAndInspect = async (page, url) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.setViewportSize(viewport);

  return await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const slider = document.querySelector(".slider-images");
    const mask = slider?.querySelector(".w-slider-mask");

    if (!slider || !mask) {
      return { missing: true };
    }

    for (let i = 0; i < 100 && !document.documentElement.className.includes("w-mod-ix3"); i += 1) {
      await wait(100);
    }

    const slides = [...mask.children].filter((child) => child.classList.contains("w-slide"));
    const activeSlide = slides[0];

    mask.style.transition = "none";
    mask.style.transform = `translateX(${-activeSlide.offsetLeft}px)`;
    mask.style.willChange = "auto";
    slider.setAttribute("data-autoplay", "false");

    slides.forEach((slide, index) => {
      const isActive = index === 0;
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
      slide.classList.toggle("w-active", isActive);
    });

    return {
      runtimeReady: document.documentElement.className.includes("w-mod-ix3"),
      sliderWidth: slider.getBoundingClientRect().width,
      maskWidth: mask.getBoundingClientRect().width,
      maskStyle: mask.getAttribute("style"),
      sliderStyle: slider.getAttribute("style"),
      sliderClasses: slider.className,
      slides: slides.map((slide, index) => ({
        index,
        className: slide.className,
        ariaHidden: slide.getAttribute("aria-hidden"),
        offsetLeft: slide.offsetLeft,
        width: slide.getBoundingClientRect().width,
        left: slide.getBoundingClientRect().left,
        img:
          slide.querySelector("img.image-cover")?.currentSrc ||
          slide.querySelector("img.image-cover")?.src ||
          null,
      })),
    };
  });
};

const browser = await chromium.launch({ headless: true });

try {
  for (const [label, url] of Object.entries(urls)) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const result = await freezeAndInspect(page, url);
    console.log(label, JSON.stringify(result, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
