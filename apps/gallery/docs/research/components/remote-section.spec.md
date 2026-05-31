# RemoteSection Specification

## Overview
- **Target file:** `public/shopify-design/index.html`
- **Screenshot:** `docs/design-references/shopify.design/remote-original.png`
- **Interaction model:** mostly static with CTA hover

## DOM Structure
- `section.section.remote`
  - `.remote-grid`
    - `.remote-line.remote-line-1` through `.remote-line.remote-line-8`
    - city labels
    - `button.remote-studio-thumb`

## Computed Styles

### Section
- `margin-top: 200px`
- `padding-bottom: 200px`

### Display Type
- `.remote .headline`
- `font-size: min(160px, 11.111vw)`
- `line-height: .85`

### Location Label
- `font-family: var(--font-mono)`
- `font-size: min(13.5px, .9375vw)`
- `line-height: 1.1`

### Studio Thumb
- `position: relative`
- `width: min(203px, 14.097vw)`
- `border-radius: min(16px, 1.111vw)`
- `overflow: hidden`

## States & Behaviors

### Typography Reveal
- **Trigger:** same display-text reveal system used elsewhere (`data-reveal="headline"`)
- **Behavior:** coordinated entrance of headline fragments

### Studio Hover
- **Trigger:** hover on `.remote-studio-thumb`
- **State A:** no scale, no glow
- **State B:** `transform: scale(1.03)`, `box-shadow: 0 0 20px #0003`

## Assets
- Studio card image and overlay mark are mirrored locally from source assets

## Text Content
- `Remote`
- `by`
- `design.`
- `Together`
- `in`
- City groups:
  - Toronto
  - Ottawa
  - New York
  - Montreal
  - Seattle

## Responsive Behavior
- **Desktop (1440px):** multi-row editorial composition across the 10-column grid
- **Mobile (768px and below):** single-column stacking with custom left padding offsets per line; city labels hide
