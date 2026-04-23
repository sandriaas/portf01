# X29.ai Full-Site Clone

This repo is a full local clone of `https://www.x29.ai/`, served from a Next.js 16 app using mirrored Webflow exports, generated route data, deterministic QA, and a Cloudflare Workers deployment target.

The homepage hero intentionally diverges from live `x29.ai`: it uses a custom responsive video pair hosted in Cloudflare R2.

## Stack

- Next.js `16.2.4`
- React `19.2.4`
- TypeScript `5`
- Tailwind CSS `4`
- OpenNext for Cloudflare Workers packaging
- Wrangler `4.84.1`
- Cloudflare Workers + R2
- Playwright for browser automation and parity audits
- ImageMagick for pixel-diff comparisons
- Webflow-exported HTML, CSS, JS, and assets mirrored locally under `src/content/x29/` and `public/x29/`

## Architecture

- [route.ts](/home/sandriaas/_projects/portf01/src/app/[[...slug]]/route.ts) is the catch-all App Router route handler for every cloned route.
- [x29-document.ts](/home/sandriaas/_projects/portf01/src/lib/x29-document.ts) rebuilds full HTML documents from page config, body HTML, metadata, and asset references.
- [x29-site.ts](/home/sandriaas/_projects/portf01/src/lib/x29-site.ts) reads from generated in-memory route data, normalizes routes, and rewrites internal links to stay local.
- [x29-site-data.ts](/home/sandriaas/_projects/portf01/src/generated/x29-site-data.ts) is the checked-in generated payload that replaces request-time filesystem reads, which keeps the app Workers-safe.
- [x29-home-hero.ts](/home/sandriaas/_projects/portf01/src/lib/x29-home-hero.ts) overrides the homepage hero with responsive landscape/portrait video selection.
- [middleware.ts](/home/sandriaas/_projects/portf01/src/middleware.ts) rewrites literal `/404` requests to the internal alias route that matches live-site behavior.
- [site.json](/home/sandriaas/_projects/portf01/src/content/x29/site.json) is the mirrored route manifest. It currently includes `14` cloned pages plus the broken-route entries audited against the live site.

## Media Strategy

- Small mirrored assets stay in [public/x29/](/home/sandriaas/_projects/portf01/public/x29/).
- The custom homepage hero MP4s live in the public R2 bucket `oregea-media`.
- Poster images are committed locally in [public/x29/media/](/home/sandriaas/_projects/portf01/public/x29/media/) so first paint does not depend on R2.
- [upload-hero-media.mjs](/home/sandriaas/_projects/portf01/scripts/upload-hero-media.mjs) takes the local source MP4s, transcodes them to web-optimized H.264 uploads, strips audio, and then publishes the optimized outputs to R2.
- Only large media is offloaded to R2 in this setup; the rest of the mirrored site assets remain local to the Worker asset bundle.

## Commands

```bash
npm run dev
npm run build
npm run start

npm run generate:x29-site-data
npm run cf:typegen
npm run cf:build
npm run cf:preview
npm run cf:deploy

npm run upload:hero-media

npm run qa:x29-site-flows
npm run qa:x29-parity
```

Set `HERO_SKIP_OPTIMIZE=1` only if you intentionally want to upload the raw source files.

Cloudflare deploy and upload commands expect credentials in the shell environment. Cloudflare secrets and API tokens are not stored in git.

## Cloudflare Deployment

- Worker config lives in [wrangler.jsonc](/home/sandriaas/_projects/portf01/wrangler.jsonc).
- OpenNext config lives in [open-next.config.ts](/home/sandriaas/_projects/portf01/open-next.config.ts).
- Generated Cloudflare env typings live in [cloudflare-env.d.ts](/home/sandriaas/_projects/portf01/cloudflare-env.d.ts).

Typical deployment flow:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_API_TOKEN=...

npm run upload:hero-media
npm run cf:deploy
```

The Worker name is `oregea`. The hero media bucket is `oregea-media`.
The current `workers.dev` URL is `https://oregea.vonzbern.workers.dev`.

## QA And Parity

- Full deterministic site audit baseline: [summary.json](/home/sandriaas/_projects/portf01/docs/design-references/qa/runs/site-flow-audit-final/summary.json)
- Latest mobile canary for the last noisy route: [summary.json](/home/sandriaas/_projects/portf01/docs/design-references/qa/runs/site-flow-audit-mobile-contact-current/summary.json)
- Current written QA verdict: [QA_REPORT.md](/home/sandriaas/_projects/portf01/docs/research/QA_REPORT.md)

The site-flow audit checks:

- visual slice diffs across desktop, tablet, and mobile
- browser-title and HTML-title parity
- internal-link rewriting
- status-code parity
- navigation, footer, broken-route, password, and contact-flow behavior

For the QA scripts, `magick` must be available on the machine.

## Project Structure

```text
src/
  app/[[...slug]]/route.ts
  content/x29/
  generated/x29-site-data.ts
  lib/x29-document.ts
  lib/x29-home-hero.ts
  lib/x29-site.ts
  middleware.ts
scripts/
  generate-x29-site-data.mjs
  qa-x29-parity.mjs
  qa-x29-site-flows.mjs
  upload-hero-media.mjs
docs/
  research/
  design-references/
public/
  x29/
wrangler.jsonc
open-next.config.ts
```
