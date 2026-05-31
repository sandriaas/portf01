# CarouselSection Specification

## Overview
- **Target file:** `public/shopify-design/index.html`
- **Screenshot:** `docs/design-references/shopify.design/carousel-original.png`
- **Interaction model:** click-driven modal cards + horizontal scroll/drag

## DOM Structure
- `section.section.carousel-section`
  - `.carousel-headline-stack`
  - `.carousel-container`
    - 10 `button.carousel-card.carousel-card--interactive`
      - `.carousel-card-shell`
      - `.carousel-card-inner`

## Computed Styles

### Headline Stack
- `padding-top: calc(100px + var(--carousel-headline-top-safety))`
- `display: flex`
- `flex-direction: column`
- `align-items: center`

### Tagline
- `margin-top: 64px`
- `font-family: var(--font-regular)`
- `font-size: var(--text-callout)`
- `line-height: 1.1`
- `letter-spacing: -.02em`

### Carousel Container
- `display: flex`
- `gap: calc(var(--card-gap) * 1px)`
- `overflow-x: auto`
- `scroll-snap-type: x mandatory`
- `padding-left/right: var(--carousel-gutter)`

### Card Shell
- `position: relative`
- `width/height: 100%`
- `overflow: hidden`
- `border-radius: var(--radius-card)`
- entrance transform from far-right translate + scale

## States & Behaviors

### Container Entrance
- **Trigger:** runtime sets `.carousel-container-entered`
- **State A:** card shells translated across viewport, `scale(2.25)`, `opacity: 0`
- **State B:** `opacity: 1`, `transform: translate(0) scale(1)`

### Card Hover
- **Trigger:** pointer hover on `.carousel-card-shell.carousel-card-hoverable`
- **State A:** `transform: none`
- **State B:** `transform: scale(1.015)`
- **Extra:** media stack images fan outward; background wordmark shifts horizontally

### Card Click
- **Trigger:** click on interactive card
- **Observed local result:** dialog opens and URL hash updates, e.g. `#context`
- **Implementation approach:** preserved Shopify runtime bundle and modal mount `.ws3-modal-overlay`

## Assets
- Background cards:
  - `/carousel/article-bg-1.png`
  - `/carousel/article-bg-2.png`
- Media:
  - `/cdn.shopify.com/...` stacked JPEGs / posters
  - `/pds-shop-design.myshopify.com/...` videos

## Text Content
- Headline: `Design` / `in public`
- Tagline: `Ideas and conversations shaping how we design at Shopify.`
- Card examples:
  - `Context`
  - `Demo Night`
  - `Dive Club`
  - `Double Diamond`
  - `Building Artifact`

## Responsive Behavior
- **Desktop (1440px):** `--card-width: 415`, `--card-height: 558`, wide bleed
- **Mobile (768px and below):** `--card-width: 320`, reduced gaps/bleed, cards scale down but preserve 3:4 aspect ratio
