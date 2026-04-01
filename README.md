# X29.ai Full-Site Clone

This repo is a full local clone of `https://www.x29.ai/`, served from a Next.js 16 app using source-synced Webflow exports, route manifests, and deterministic visual QA.

## Stack

- Next.js `16.2.1`
- React `19.2.4`
- TypeScript `5`
- Tailwind CSS `4`
- Playwright for browser automation and parity audits
- ImageMagick for pixel-diff comparisons
- Webflow-exported HTML, CSS, JS, and assets mirrored locally under `src/content/x29/` and `public/x29/`

## How The App Works

- [route.ts](/home/sandriaas/_projects/portf01/src/app/[[...slug]]/route.ts) is a catch-all App Router route handler that serves raw HTML documents for every cloned route.
- [x29-document.ts](/home/sandriaas/_projects/portf01/src/lib/x29-document.ts) rebuilds complete HTML documents from per-page config, body HTML, metadata, and script/style entries.
- [x29-site.ts](/home/sandriaas/_projects/portf01/src/lib/x29-site.ts) loads the site manifest, reads page exports, normalizes routes, and rewrites internal links to stay local.
- [proxy.ts](/home/sandriaas/_projects/portf01/src/proxy.ts) rewrites literal `/404` requests to the internal alias route that matches the live site behavior.
- [site.json](/home/sandriaas/_projects/portf01/src/content/x29/site.json) is the route manifest for the exported site. It currently includes `14` cloned pages plus `2` broken-route entries audited as live-site `404`s.

## Local Content

- Page configs and body HTML live in `src/content/x29/pages/`
- Mirrored static assets live in `public/x29/`
- Current mirrored asset count: `145` files

## Commands

```bash
npm run dev
npm run build
npm run start
npm run qa:x29-site-flows
npm run qa:x29-parity
```

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
  lib/x29-document.ts
  lib/x29-site.ts
  proxy.ts
scripts/
  qa-x29-parity.mjs
  qa-x29-site-flows.mjs
docs/
  research/
  design-references/
public/
  x29/
```
