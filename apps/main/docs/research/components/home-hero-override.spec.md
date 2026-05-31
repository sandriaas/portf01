# Hero Override (`x29-home-hero`) Specification

## Overview
- **Target file:** `src/lib/x29-home-hero.ts`
- **Trigger:** `applyX29HomeHeroOverride()` runs in `src/lib/x29-site.ts:43` and replaces the live Webflow `<section class="section hero-home-section">` HTML on route `/` with a locally-served, deterministic version.
- **Reason for existing:** the upstream Webflow hero pulls a CDN-hosted Webflow background-video (`.video-home-hero`). For deterministic local builds and self-hosted media we replace it with a `.x29-home-hero-media` shell that serves files from `/x29/media/hero/home/`.
- **Screenshots:** `docs/design-references/qa/clone-diff/{live,local}-{desktop,mobile}-hero.png`
- **Interaction model:** static (autoplay loop), no scroll/click triggers within the hero. Headline opacity reveal is controlled by Webflow IX3 (untouched by the override).

## DOM Structure
```
<section class="section hero-home-section">
  <style>…</style>
  <div data-home-hero data-home-hero-state="poster" class="x29-home-hero-media">
    <div class="x29-home-hero-stack">
      <video id="x29-home-hero-video"
             autoplay loop muted playsinline preload="auto"
             poster="…landscape-poster.jpg"
             style="background-image:url(…landscape-poster.jpg)"
             class="x29-home-hero-video">
        <source src="…refreshed.webm" type="video/webm" />
        <source src="…refreshed.mp4"  type="video/mp4" />
      </video>
      <img id="x29-home-hero-poster" src="…landscape-poster.jpg"
           class="x29-home-hero-poster" />
    </div>
    <script>…orientation/fallback runtime…</script>
    <div class="w-layout-blockcontainer main-container w-container x29-home-hero-content">
      <div class="home-hero-wrap">
        <div class="headline-home-hero">
          <h1>An Experimental Lab for AI-Native Enterprise.</h1>
          <a href="/contact" class="cta-main w-inline-block">…</a>
        </div>
        <div class="home-hero-bottom-tile">
          <div class="label-small text-light-48">Port Co:&nbsp;<br/>Conducting AI</div>
          <div class="text-align-right label-small text-light-48">Special<br/>Projects</div>
        </div>
      </div>
    </div>
  </div>
</section>
```

## Computed Styles (1440×900 desktop, parity with live)

### `.hero-home-section`
- width: 1440px, height: 900px

### `.x29-home-hero-media`
- position: relative; display: flex; overflow: hidden; isolation: isolate
- width: 1424px; min-height: calc(100vh - var(--_spacing---spacing--8) * 2)
- padding-top: var(--_spacing---spacing--top-padding); padding-bottom: var(--_spacing---spacing--32)
- border-radius: var(--radius--radius-3); background-color: #000

### `.x29-home-hero-stack`
- position: absolute; inset: 0; z-index: 0; background: #000

### `.x29-home-hero-video`
- position: absolute; inset: 0; width: 100%; height: 100%
- object-fit: cover; background-position: 50%; background-size: cover

### `.x29-home-hero-poster`
- position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover
- z-index: 1; opacity: 1; transition: opacity .28s ease; pointer-events: none

### `.x29-home-hero-content` (overrides Webflow's `.main-container`)
- z-index: 2; position: relative; display: block; width: 100%

### `.home-hero-wrap` (after fix)
- live  rect: x=40  y=224  w=1360  h=636
- local rect: x=40  y=224  w=1360  h=636

### `.headline-home-hero` (after fix)
- live  rect: x=264 y=608  w=912   h=216
- local rect: x=264 y=608  w=912   h=216

### `h1` (after fix)
- live  rect: x=264 y=608  w=912   h=152
- local rect: x=264 y=608  w=912   h=152
- font-size: 88px; text-align: center

## States & Behaviors

### Wrapper state machine (`data-home-hero-state`)
- **poster** (initial): `.x29-home-hero-poster { opacity: 1 }`
- **video** (after `loadeddata`): `.x29-home-hero-poster { opacity: 0 }` via attribute selector + 280ms ease transition
- **error**: poster stays opaque, console.warn fires

### Video element
- `autoplay loop muted playsinline preload="auto"`
- Inline poster as `background-image` (live's pattern) so the first paint shows the still even when codec/decoder fails.
- `<source>` order: WebM (VP9) first, then MP4 (H.264). Browsers without H.264 (e.g. chromium-headless-shell on some configs) decode the WebM.

### Orientation switching (script in `renderHomeHeroScript`)
- `matchMedia("(orientation: portrait)")` and `window.innerWidth <= 767` route to the portrait variant.
- On variant switch, `<video>.src` is rewritten and `.load()` called.

## Per-State Content
N/A — single static state.

## Assets
- `public/x29/media/hero/home/refreshed.mp4` (13,148,937 bytes, H.264)
- `public/x29/media/hero/home/refreshed.webm` (10,254,105 bytes, VP9, transcoded with `ffmpeg -c:v libvpx-vp9 -crf 32 -an`)
- `public/x29/media/home-hero-landscape-poster.jpg` (78,687 bytes, 1280×720)
- `public/x29/media/home-hero-portrait-poster.jpg` (existing)

## Text Content (verbatim)
- H1: `An Experimental Lab for AI-Native Enterprise.`
- CTA: `Contact Us` → `/contact`
- Bottom-left: `Port Co: <br>Conducting AI`
- Bottom-right: `Special<br>Projects`

## Responsive Behavior
- **Desktop (≥768px):** landscape variant served, headline 88px, centered
- **Mobile (<768px):** portrait variant served (currently same source), headline 56px, centered
- Breakpoint: 767px (`@media screen and (max-width:767px)`)

## Diff vs live (post-fix)
Generated by `scripts/clone-diff.mjs`, captured at desktop=1440px and mobile=390px.

| Section  | Δ rect | Style Δ |
|----------|--------|---------|
| hero     | 0/0/0/0 | 0       |
| nav      | 0/0/0/0 | 0       |
| overlap  | 0/0/0/0 | 0       |
| work     | 0/0/0/0 | 0       |
| services | 0/0/0/0 | 0       |
| video    | 0/0/0/0 | 1*      |
| numbers  | 0/0/0/0 | 0       |
| footer   | 0/0/0/0 | 0       |

\* video section's `background-image` URL points at `/x29/cdn.prod.website-files.com/...` (Webflow asset proxied locally) instead of the live `https://cdn.prod.website-files.com/...`. The image content is identical.

## Bug found and fixed in this pass
- **`.x29-home-hero-content { display: flex }`** caused `.home-hero-wrap` (and therefore `.headline-home-hero` + `h1`) to collapse to its content width 912px instead of stretching to the full 1360px container. This produced a +224px horizontal offset of the headline at desktop, exactly matching the user's report ("hero header alignment doesn't match"). Fix: `display: block; width: 100%`.

Verified via `node scripts/clone-diff-hero.mjs` — every tracked rect now matches live exactly.
