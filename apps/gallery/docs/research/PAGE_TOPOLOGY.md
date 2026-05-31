# Shopify Design Homepage Topology

## URL
- `https://shopify.design/`

## Overall Structure
- Root wrapper: `#root > [data-dom-layout] > .layout-root`
- Primary content flow: `.site-header` overlay + `.layout-inner`
- Visual style: white background, oversized serif display type, mono metadata labels, rounded card system, heavy motion on first load
- Grid system: `--grid-max: 1440px`, `--grid-cols: 10`, `--page-pad: 48px`, `--page-pad-mobile: 16px`

## Top-Level Sections

### 1. Site Header
- DOM node: `header.site-header`
- Positioning: absolute overlay, top-level over hero
- Contents: Shopify Design logo + marquee CTA pill linking to Luma
- Interaction model: time-driven intro animation, hover-driven button micro-motion

### 2. Hero
- DOM node: `section.section.hero`
- Contents:
  - Two-line display headline
  - Hero tagline
  - Live bar linking to `#building-artifact`
  - Three-column masonry-like grid of 19 interactive video cards
- Interaction model: time-driven intro animation, hover micro-motion, click-driven video/modal routing

### 3. Countdown / Manifesto
- DOM node: `section.section.countdown`
- Contents:
  - Sticky 600vh scroll stage
  - Circular countdown ring
  - Large `26` headline
  - Manifesto block with CTA
- Interaction model: scroll-driven sticky sequence

### 4. Design In Public Carousel
- DOM node: `section.section.carousel-section`
- Contents:
  - Two-line headline
  - Tagline
  - Horizontal snap carousel of 10 interactive cards
- Interaction model: click-driven modal opening, horizontal scroll / drag, hover card motion

### 5. Remote By Design
- DOM node: `section.section.remote`
- Contents:
  - Multi-line oversized headline assembled across grid rows
  - City labels
  - Studio thumbnail CTA inside the typography layout
- Interaction model: mostly static with hover on studio card

### 6. Footer
- DOM node: `footer.site-footer`
- Contents:
  - Shopify Design / year top row
  - Divider rule
  - Final headline
  - Open roles CTA
- Interaction model: static with CTA hover motion

### 7. Modal Overlay
- DOM node: `.ws3-modal-overlay`
- Positioning: fixed full-screen overlay outside `#root`
- Contents:
  - Backdrop
  - Cursor-close affordance
  - Empty `.ws3-modal-card` mount point populated at runtime
- Interaction model: click-driven / route-hash-driven modal system

## Current Local Assembly
- Root path `/` rewrites to `public/shopify-design/index.html`
- Homepage HTML is the captured rendered document from `shopify.design`
- Same-origin assets are mirrored under `public/icons`, `public/fonts`, `public/favicons`, `public/carousel`, `public/clock`
- CDN and media assets are mirrored under `public/cdn.shopify.com` and `public/pds-shop-design.myshopify.com`
