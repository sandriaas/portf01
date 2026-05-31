# HeroSection Specification

## Overview
- **Target file:** `public/shopify-design/index.html`
- **Screenshot:** `docs/design-references/shopify.design/hero-original.png`
- **Interaction model:** time-driven intro + hover/click cards

## DOM Structure
- `header.site-header`
  - `img.site-logo`
  - `a.header-cta-link > .button-row.btn-cta.hero-cta`
- `section.section.hero`
  - `.hero-headline-wrap`
  - `.hero-live-bar`
  - `.hero-grid`
    - 3 `.hero-grid-col`
    - 19 `button.hero-grid-card` items

## Computed Styles

### Header
- `position: absolute`
- `top: -40px`
- `left/right: 0`
- `padding: var(--hero-header-pad-top) var(--hero-header-pad-x) var(--hero-header-pad-bottom)`
- `opacity: 0`

### Headline
- `font-family: var(--font-headline)`
- `font-weight: 500`
- `line-height: .7`
- `letter-spacing: -.04em`
- `color: var(--color-black)`
- `font-size: var(--hero-fs)`

### Tagline
- `grid-column: 4 / span 4`
- `margin-top: 40px`
- `font-family: var(--font-regular)`
- `font-size: var(--text-callout)`
- `line-height: 1.1`
- `letter-spacing: -.02em`

### Live Bar
- `display: flex`
- `gap: 16px`
- `margin: 112px auto 0`
- `padding: 0 var(--hero-live-pad-x)`
- `font-family: var(--font-mono)`
- `font-size: var(--text-meta)`
- `text-transform: uppercase`

### Grid Card
- `display: block`
- `width: 100%`
- `background: var(--card-bg, #f0f0f0)`
- `position: relative`
- `overflow: hidden`
- `border-radius: var(--radius-card)`
- `border: 1px solid rgba(0,0,0,.04)`

## States & Behaviors

### Header Intro
- **Trigger:** initial page load
- **State A:** `top: -40px`, `opacity: 0`
- **State B:** `top: 0`, `opacity: 1`
- **Transition:** `header-in .8s var(--ease-out-expo) var(--header-delay, 2s)`

### Hero Rise
- **Trigger:** initial page load
- **State A:** translated downward using `transform: translateY(...)`
- **State B:** `transform: translateY(0)`
- **Transition:** `hero-rise var(--hero-rise-dur, 2.4s) var(--ease-in-out-quint)`

### Live Bar Reveal
- **Trigger:** initial page load with `.tagline-in`
- **State A:** `clip-path: inset(0 100% 0 0)`
- **State B:** `clip-path: inset(0 0 0 0)`
- **Transition:** `live-bar-reveal 1.6s var(--ease-out-expo)`

### Card Entrance
- **Trigger:** initial page load
- **State A:** `opacity: 0`, translated by per-card CSS variables, `scale(1.5)`
- **State B:** `opacity: 1`, `translate(0) scale(1)`
- **Transition:** `card-slide-in`

### Card Hover
- **Trigger:** pointer hover
- **State A:** `transform: none`, `box-shadow: var(--shadow-card-hover-off)`
- **State B:** `transform: scale(1.015)`, `box-shadow: var(--shadow-card-hover)`
- **Transition:** `.65s var(--ease-spring-bouncy)`

## Assets
- Local same-origin assets:
  - `/icons/logo.svg`
  - `/icons/arrow-outward.svg`
- Local mirrored CDN/media assets:
  - `/cdn.shopify.com/...` poster images
  - `/pds-shop-design.myshopify.com/...` video sources

## Text Content
- Headline: `Make the` / `new normal`
- Tagline: `How we work is changing shape. So is what’s possible.`
- Live label: `LIVE`
- Link label: `FROM ARTIFACT`

## Responsive Behavior
- **Desktop (1440px):** 10-column grid, 3-column hero card layout, large header CTA pill
- **Mobile (768px and below):** headline and tagline collapse to one-column layout, hero card radius becomes `12px`, CTA compresses and hides date/icon details
