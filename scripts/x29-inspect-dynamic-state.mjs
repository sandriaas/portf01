import { chromium } from "playwright";

const viewport = {
  width: Number.parseInt(process.env.X29_VIEWPORT_WIDTH ?? "390", 10),
  height: Number.parseInt(process.env.X29_VIEWPORT_HEIGHT ?? "844", 10),
};

const targets = [
  { label: "work-marquee", selector: ".home-work-section .master-blured-marquee" },
  { label: "work-projects", selector: ".home-work-section .projects" },
  { label: "work-button", selector: ".home-work-section .button-wrap-home-work" },
  { label: "video-section", selector: ".home-video-section" },
  { label: "video-content", selector: ".home-video-section .master-home-story" },
];

const pages = {
  live: "https://www.x29.ai/",
  local: "http://127.0.0.1:3011/",
};

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

async function freezePage(page) {
  await page.evaluate(async () => {
    let qaStyle = document.getElementById("x29-qa-style");

    if (!(qaStyle instanceof HTMLStyleElement)) {
      qaStyle = document.createElement("style");
      qaStyle.id = "x29-qa-style";
      qaStyle.textContent = `
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(qaStyle);
    }

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const deadline = performance.now() + 7000;

    const freezeVideo = (selector, targetTime) => {
      const video = document.querySelector(selector);

      if (!(video instanceof HTMLVideoElement)) {
        return false;
      }

      try {
        video.currentTime = targetTime;
      } catch {}

      try {
        video.pause();
      } catch {}

      video.autoplay = false;
      video.loop = false;
      video.muted = true;
      video.removeAttribute("autoplay");
      video.removeAttribute("loop");
      return Number.isFinite(video.readyState) && video.readyState >= 1;
    };

    const freezeSlider = () => {
      const slider = document.querySelector(".slider-images");
      const mask = slider?.querySelector(".w-slider-mask");

      if (!slider || !mask) {
        return false;
      }

      const slides = [...mask.children].filter((element) =>
        element.classList.contains("w-slide"),
      );

      if (slides.length === 0) {
        return false;
      }

      const activeSlide = slides[0];
      mask.style.transition = "none";
      mask.style.transform = "translateX(" + -activeSlide.offsetLeft + "px)";
      slides.forEach((slide, index) => {
        const isActive = index === 0;
        slide.setAttribute("aria-hidden", isActive ? "false" : "true");
        slide.classList.toggle("w-active", isActive);
      });

      return true;
    };

    while (performance.now() < deadline) {
      const runtimeReady = document.documentElement.className.includes("w-mod-ix3");
      const videosReady =
        freezeVideo(".video-home-hero video", 0.1) &&
        freezeVideo(".video-footer video", 0.1);
      const sliderReady = freezeSlider();

      if (runtimeReady && videosReady && sliderReady) {
        return;
      }

      await wait(100);
    }
  });
}

try {
  for (const [name, url] of Object.entries(pages)) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
    });

    await freezePage(page);

    const results = [];

    for (const target of targets) {
      const info = await page.evaluate(async (input) => {
        const element = document.querySelector(input.selector);

        if (!(element instanceof HTMLElement)) {
          return { label: input.label, missing: true };
        }

        const top = Math.round(element.getBoundingClientRect().top + window.scrollY);
        window.scrollTo({ top, behavior: "instant" });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))),
        );

        const rect = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        const descendants = [...element.querySelectorAll("*")]
          .slice(0, 80)
          .map((node) => {
            const s = getComputedStyle(node);
            return {
              tag: node.tagName,
              className: node.className,
              text: (node.textContent || "").trim().slice(0, 60),
              transform: s.transform,
              opacity: s.opacity,
              filter: s.filter,
              mixBlendMode: s.mixBlendMode,
            };
          })
          .filter(
            (entry) =>
              entry.transform !== "none" ||
              entry.opacity !== "1" ||
              entry.filter !== "none" ||
              entry.mixBlendMode !== "normal",
          );

        return {
          label: input.label,
          selector: input.selector,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          transform: styles.transform,
          opacity: styles.opacity,
          filter: styles.filter,
          descendants,
        };
      }, target);

      results.push(info);
    }

    console.log(name, JSON.stringify(results, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
}
