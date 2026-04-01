# X29.ai Clone QA Report

## Current Verdict
- The earlier full-site QA caveat is closed.
- The hardened site-flow audit now proves `0%` visual diff for every audited route, every audited viewport, and every audited scroll slice in the current full-site matrix.
- Internal-link cleanup, HTTP status parity, browser-title parity, HTML-title parity, and flow coverage are all clean in the same run.

## Latest Proof Set
- Full site-flow audit: `docs/design-references/qa/runs/site-flow-audit-final/summary.json`
- Targeted canary rerun used to close the last noisy routes: `docs/design-references/qa/runs/site-flow-audit-targeted-fix/summary.json`

From `site-flow-audit-final/summary.json`:
- `routeCount`: `16`
- `viewports`: `desktop`, `tablet`, `mobile`
- `stepRatios`: `0`, `0.5`, `1`
- `sliceSummary.total`: `48`
- `sliceSummary.zeroDiff`: `48`
- `sliceSummary.linkClean`: `48`
- `sliceSummary.statusMatch`: `48`
- `sliceSummary.titleMatch`: `48`
- `flowSummary.total`: `9`
- `flowSummary.passed`: `9`
- `runtimeError` count: `0`

## What Changed
- The site-flow runner in `scripts/qa-x29-site-flows.mjs` now uses deterministic capture instead of loose delay-based screenshots.
- The freeze pass now:
  - pauses Web Animations, GSAP, and ScrollTrigger
  - normalizes marquee, split-text, and overlap text transforms
  - freezes Webflow sliders to a fixed index
  - freezes videos and, when a poster is available, swaps background-video rendering to the poster image to remove codec/frame timing noise
- Route metadata loading in `src/lib/x29-site.ts` now recursively decodes HTML entities so raw head titles and browser titles stay aligned with the live site.

## Why The Old Caveat Is Gone
- The earlier noise was not a route-plumbing problem. It came from time-varying layers that were still moving during capture, especially background videos and marquee tracks on 404-style pages.
- After hardening the freeze pipeline, the previous outlier routes dropped to `0%` in the targeted rerun, and the full-site rerun stayed clean across all 48 audited route/viewport combinations.

## Verification
- `npm run build`: pass
- `node --check scripts/qa-x29-site-flows.mjs`: pass
- Production server audit origin: `http://127.0.0.1:3012`
