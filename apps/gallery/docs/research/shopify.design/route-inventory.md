# Shopify Design Route Inventory

Audit date: April 9, 2026

## Findings

- Public canonical route: `https://shopify.design/`
- Canonical tag on the live site resolves to `https://shopify.design/`
- The live HTML stream exposes a React Router `_index` payload and no additional first-party route URLs
- `https://shopify.design/robots.txt` returns `404 Not Found`
- `https://shopify.design/sitemap.xml` returns `404 Not Found`
- A recursive spider against `https://shopify.design/` discovered the homepage plus static asset URLs, but no additional public HTML routes

## Covered Surface

- `/`
- Hash and modal states embedded in the homepage app shell, including manifesto, article, photo, photo-group, and video experiences
- External outbound links from the homepage, such as Luma, X, and Shopify careers, are not part of the `shopify.design` site surface

## Local Clone Implication

- The current mirror target is effectively a single-route site
- The homepage clone and localized modal/media runtime cover the public first-party site surface as of April 9, 2026
- Future work should focus on browser-level fidelity passes or re-auditing the route surface if Shopify adds new first-party routes later
