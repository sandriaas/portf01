# Shopify Design Reverification Report

Audit date: April 9, 2026

## Scope

- Revalidated the current first-party `shopify.design` surface against the public homepage at `https://shopify.design/`
- Re-ran localized mirror hardening with `npm run localize:shopify-home`
- Re-ran production verification with `npm run verify:shopify-home`
- Refreshed browser comparison captures for the current homepage shell

## Automated Verification

`npm run verify:shopify-home` passed on `2026-04-09T04:07:43.739Z`.

Verification summary:

- Mirrored text files scanned: `12`
- Referenced localized assets resolved: `235`
- Mirrored MP4 assets discovered: `61`
- Mirrored images referenced by the HTML/CSS surface scan: `24`
- Served asset URLs discovered from the production homepage response: `235`
- Runtime JS/CSS bundle paths smoke-checked: `8`
- Total production smoke requests passed: `30`

The verifier confirmed:

- `/` responds successfully from the production build
- Core mirrored JS/CSS bundles, fonts, favicons, Draco files, and sampled media resolve locally
- Mirrored HTML/runtime text files do not retain raw runtime dependencies on:
  - `https://cdn.shopify.com`
  - `https://pds-shop-design.myshopify.com`
  - `https://www.googletagmanager.com`
  - `https://www.clarity.ms`
  - `https://www.gstatic.com/draco`

## Live Runtime Recheck

The current live homepage still ships the same Oxygen asset graph the clone is pinned to:

- `entry.client-B8ftjTuC.js`
- `root-CRV0kK55.js`
- `_index-DATvhclo.js`
- `index-BxNsuFNe.css`
- `_index-d1PKX52d.css`
- `manifest-9719090d.js`

The public route surface remains unchanged from the route inventory:

- Public first-party route: `/`
- Modal and hash states are embedded in the homepage shell
- `robots.txt` and `sitemap.xml` still return `404`

## Browser Surface Checks

Observed live/local DOM counts match on the homepage shell:

- Header CTA: `1`
- Hero cards: `19`
- Manifesto CTA: `1`
- Carousel interactive cards: `10`
- Remote studio thumbnail: `1`
- Footer CTA link: `1`
- Modal overlay mount: `1`

Stable browser artifacts:

- Canonical parity JSON: [browser-parity-2026-04-09.json](/home/sandriaas/_projects/travelapp-draft2/docs/research/shopify.design/browser-parity-2026-04-09.json)
- Connected-Chrome frozen desktop live capture: [live-desktop-realchrome-frozen-2026-04-09.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/live-desktop-realchrome-frozen-2026-04-09.png)
- Connected-Chrome frozen desktop local capture: [local-desktop-realchrome-frozen-2026-04-09.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/local-desktop-realchrome-frozen-2026-04-09.png)
- Connected-Chrome frozen desktop diff: [desktop-realchrome-frozen-diff-2026-04-09.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/desktop-realchrome-frozen-diff-2026-04-09.png)
- Current headless desktop diff: [desktop-2026-04-09-diff.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/desktop-2026-04-09-diff.png)
- Current headless tablet diff: [tablet-2026-04-09-diff.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/tablet-2026-04-09-diff.png)
- Current headless mobile diff: [mobile-2026-04-09-diff.png](/home/sandriaas/_projects/travelapp-draft2/docs/design-references/shopify.design/mobile-2026-04-09-diff.png)

## Discrepancy Status

No structural discrepancies were found in:

- Live bundle naming versus mirrored bundle naming
- Root route delivery at `/`
- Localized runtime host rewrites
- Homepage shell counts for hero, carousel, remote, and footer surfaces

Residual verification gap:

- The connected-Chrome parity path is now implemented as the default mode in [capture-shopify-browser-parity.mjs](/home/sandriaas/_projects/travelapp-draft2/scripts/capture-shopify-browser-parity.mjs), but the current Playwriter relay is timing out during `Target.createTarget`, so the repo cannot yet regenerate the full real-Chrome matrix unattended.
- The last successful connected-Chrome desktop frozen comparison reduced the live/local top-viewport mismatch to `0.006476`, which strongly suggests the previous desktop delta was dominated by unsynchronized media frames rather than structural clone drift.
- Headless capture remains available as a diagnostic path via `npm run capture:shopify-browser-parity:headless`, but it is not the final acceptance gate for parity claims.
