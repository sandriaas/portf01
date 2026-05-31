# Behavior bible — x29.ai homepage

## Header / nav
- Position: lives inside `.nav-wrap-animation > .master-navigation`, fixed/sticky behavior driven by Webflow IX3.
- Reveal: `.nav-wrap-animation` starts hidden (Webflow's `html.w-mod-js:not(.w-mod-ix3) :is(.nav-wrap-animation, …) { visibility: hidden !important }`) and is animated in once IX3 ready.
- No scroll-position breakpoint that resizes the navbar — it stays the same shape.

## Hero
- Static autoplay loop (muted, playsinline). Override layer in `x29-home-hero.ts` mirrors live's `.video-home-hero` skeleton:
  - `<video>` with `<source>` per codec (webm + mp4) and inline `background-image` poster as fallback.
  - `data-home-hero-state` toggles `poster → video` once `loadeddata` fires; poster fades 280ms.
- Headline reveal driven by Webflow IX3 (`html.w-mod-ix3 .headline-home-hero` opacity/translate). The capture harness must wait for IX3 or force-show the element.
- Layout fix recorded: `.x29-home-hero-content` must be `display: block; width: 100%` to allow `.home-hero-wrap` to span the full container (live's behavior). `display: flex` collapses children to content-width.

## Overlap section (`section.home-overlap-section`)
- Sticky copy paired with cycling images on the right. Driven by Webflow tabs script + IX3 (no custom JS in this repo).
- All `[text-left]`, `[text-right]`, `.marquee-text`, `.marquee-images`, etc. start hidden and reveal via IX3.

## Work section
- Blurred-edge marquee with overlay (`.master-blured-marquee`, `.overlay-marquee-blur`) + project cards. Cards have hover overlays (`.card-project [cms-overlay]`, `.card-project [cms-image]`) that are pre-hidden until IX3 reveals.
- `.marquee` duplicates its content for an infinite-scroll loop (Webflow native).

## Services section
- Static grid; no interactive states beyond hover.

## Video section
- Webflow background-video shell: `<video class="video-home-hero w-background-video">` with poster image baked into `style="background-image:url(...)"` and `<source>` tags for mp4+webm.
- Local diff shows only an asset-host difference; pixel match is identical.

## Numbers section
- Counter blocks animated on enter via Webflow IX3 (count-up). No custom code.

## Footer
- Autoplay background video (`.video-footer`), marquee, and link grid. Same pre-hide rules apply via the global `html.w-mod-js:not(.w-mod-ix3)` rule.

## Global
- Webflow IX3 (`webflow.schunk.*.js`) governs every reveal/animation. Anything that looks "missing" in a static screenshot is almost always IX3 not having run yet.
- Smooth scroll: native browser scroll only; no Lenis or Locomotive Scroll classes detected.
- Asset host: `cdn.prod.website-files.com/68a07b4456582bc42d1b3e95/...` is rewritten locally to `/x29/cdn.prod.website-files.com/...` and served via the proxy route.
