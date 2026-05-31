# portf03

Next.js 16 project for a high-fidelity local clone of `https://shopify.design/`, with mirrored assets, intro/parity capture tooling, and verification scripts for homepage fidelity work.

## Stack

- Next.js 16
- React 19
- TypeScript
- Playwright

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run localize:shopify-home
npm run verify:shopify-home
npm run capture:shopify-browser-parity
npm run capture:shopify-intro
```

## Project Notes

- `/` is served as the Shopify Design clone entrypoint.
- Mirrored runtime and assets live under [`public/`](./public).
- Research artifacts and parity captures live under [`docs/`](./docs).
- Helper automation for localization, verification, and capture lives under [`scripts/`](./scripts).

## Local Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

Run the homepage production verification flow:

```bash
npm run verify:shopify-home
```

This builds the app and validates mirrored homepage assets and smoke checks.
