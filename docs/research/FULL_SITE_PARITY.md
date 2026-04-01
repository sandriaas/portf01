# Full Site Parity

The full-site route and flow audit lives in `scripts/qa-x29-site-flows.mjs`.

It verifies:

- exported routes and intentional broken CMS routes
- local vs live HTML titles and status codes
- local internal links/actions staying local after export
- representative flows across nav, footer, broken links, contact, and password page behavior
- viewport-slice screenshots instead of stitched full-page captures, which is safer for scroll-driven sections

Run:

```bash
npm run qa:x29-site-flows
```

Useful env overrides:

```bash
X29_LOCAL_ORIGIN=http://127.0.0.1:3012 \
X29_SITE_QA_VIEWPORTS=desktop \
X29_SITE_QA_STEPS=0,0.5,1 \
npm run qa:x29-site-flows
```
