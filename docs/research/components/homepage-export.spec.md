# Homepage Export Specification

## Overview
- Target route: `src/app/page.tsx`
- Source of truth body: `src/content/x29-body.html`
- Source of truth head/runtime config: `src/content/x29-config.json`
- Local asset root: `public/x29/`
- Rendering strategy: source-synced Webflow export with local CSS, JS, fonts, images, videos, and icons

## Why this approach
- The page is a Webflow production export with tightly coupled CSS and runtime behavior.
- Pixel parity is higher by preserving the original DOM, class names, media, and script order than by re-authoring sections manually.
- The clone remains local and self-contained because all remote assets are rewritten into `public/x29/`.

## Script order
1. Local jQuery copy
2. Webflow chunk `webflow.schunk.36b8fb49256177c8.js`
3. Webflow chunk `webflow.schunk.6d20ecf57b62e545.js`
4. Webflow runtime `webflow.5847fc92.29dab03920c50b34.js`
5. GSAP core
6. GSAP SplitText
7. GSAP ScrollTrigger

## Critical runtime requirement
- These scripts must render as normal body-end `<script>` tags.
- Using Next's client-side script loader prevented the page from reaching `w-mod-ix3`, which left the hero and other animated elements hidden.

## Responsive behavior
- Desktop reference captured at `1440px`
- Tablet reference captured at `768px`
- Mobile reference captured at `390px`
- The local clone matched the original visually at desktop and mobile after restoring body-end script timing.

## Assets
- Total downloaded local files: 116
- Includes: CSS, JS, fonts, icons, images, videos, favicons, OG image
- Manifest: `docs/research/x29-asset-manifest.json`
