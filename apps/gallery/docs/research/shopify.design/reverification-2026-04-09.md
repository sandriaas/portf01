# Shopify Design Reverification

Audit date: April 9, 2026

## Scope

- First-party public surface: `https://shopify.design/`
- Embedded homepage hash and modal states only
- External outbound links on Luma, X, and Shopify Careers remain out of scope

## Automation

- `npm run build`
- `npm run verify:shopify-home`

Latest `verify:shopify-home` summary:

```json
{
  "verifiedAt": "2026-04-09T02:36:31.983Z",
  "textFileCount": 12,
  "referencedAssetCount": 235,
  "mirroredMp4Count": 61,
  "mirroredImageCount": 24,
  "skippedLive404PathCount": 15,
  "servedAssetCount": 235,
  "runtimePathCount": 8,
  "smokeCheckCount": 30,
  "serverUrl": "http://127.0.0.1:3105"
}
```

What the verifier covers:

- Required mirror files exist under `public/`
- Mirrored text assets are free of forbidden remote host leaks
- The served homepage HTML and served runtime bundles are free of forbidden remote host leaks
- Localized mirrored media exists for homepage runtime references
- The production server responds `200` for `/`, required runtime bundles, core static assets, Draco files, and sampled mirrored media

## Browser Checks

- Live and local homepage accessibility snapshots matched at the top-level route structure: banner, hero grid, manifesto CTA, carousel section, studio section, and footer CTA
- The manifesto modal opens locally and exposes the same copy surfaced on the live site
- The `#context` modal opens locally and its active video resolves to the mirrored MP4 path under `/pds-shop-design.myshopify.com/...mp4`
- Route scope remains unchanged from the route inventory: `/` plus hash/modal states only

## Visual Artifacts

- Desktop top viewport:
  - `docs/design-references/shopify.design/live-desktop-top-2026-04-09.png`
  - `docs/design-references/shopify.design/local-desktop-top-2026-04-09.png`
- Mobile top viewport:
  - `docs/design-references/shopify.design/live-mobile-top-2026-04-09.png`
  - `docs/design-references/shopify.design/local-mobile-top-2026-04-09.png`

Observed screenshot compare metrics:

- Desktop top RMSE: `35468.3 (0.541211)`
- Mobile top RMSE: `28740.5 (0.438551)`

These diffs are dominated by autoplaying media, video decode timing, and frame selection inside the hero/cards rather than a confirmed structural layout regression.

## Discrepancy Ledger

- No blocking first-party route or runtime leak regressions were found in the current homepage clone
- The verifier now ignores 15 root-level fallback asset paths that the live `shopify.design` runtime also returns `404` for
- Representative live-404 fallbacks:
  - `/fonts/AntiqueLegacy-Regular.woff`
  - `/fonts/AntiqueLegacy-Medium.woff`
  - `/fonts/AntiqueLegacy-Light.woff`
  - `/fonts/FragmentMono-Regular.ttf`
  - `/icons/player-play.svg`
  - `/icons/player-pause.svg`
  - `/icons/player-volume-on.svg`
  - `/icons/player-volume-off.svg`
  - `/icons/player-fullscreen.svg`
  - `/icons/studio-logo.png`

## Current Status

- Homepage clone coverage is complete for the currently discoverable public `shopify.design` surface
- Remaining fidelity work, if needed later, should focus on frame-stable visual diff tooling for autoplay-heavy sections rather than additional first-party routes
