# CountdownManifesto Specification

## Overview
- **Target file:** `public/shopify-design/index.html`
- **Screenshot:** `docs/design-references/shopify.design/countdown-original.png`
- **Interaction model:** scroll-driven sticky sequence

## DOM Structure
- `section.section.countdown`
  - `.countdown-stage`
    - `.countdown-stage-sticky`
      - `.dom-clock-wrap`
      - `.dom-clock-hand-wrap`
      - `.manifesto.manifesto--countdown`
      - `[data-id=countdown-headline]`
      - `.shape.cd-ring`

## Computed Styles

### Section
- `position: relative`
- `pointer-events: none`
- `margin-top: max(-140vh, -1300px)`
- `padding-bottom: calc(var(--ring-size) * .35)`

### Sticky Stage
- `height: 600vh`
- child sticky wrapper: `position: sticky; top: 0; height: 100dvh`

### Manifesto Headline
- `font-weight: 500`
- `font-size: var(--text-heading)`
- `line-height: .85`
- `letter-spacing: -.03em`

### Manifesto Body
- `font-family: var(--font-regular)`
- `font-size: var(--text-body)`
- `line-height: 1.1`
- `letter-spacing: -.02em`

## States & Behaviors

### Sticky Ring Scene
- **Trigger:** viewport scroll inside `.countdown-stage`
- **State A:** large circular ring and digits off their final storytelling positions
- **State B:** manifesto copy and CTA occupy the sticky scene while the ring/digits continue scroll choreography
- **Implementation approach:** CSS sticky layout plus runtime scroll scripting from mirrored Shopify bundle

### CTA Button
- **Trigger:** hover
- **Behavior:** same pill hover motion as global CTA system

## Assets
- `/clock/clock-hand-dial.webp`
- `/icons/design-mark-white.svg`
- `/icons/arrow-forward-white.svg`

## Text Content
- Headline: `Make commerce better for everyone.`
- Body: `Every 26 seconds, a merchant makes their first sale on Shopify. That kind of scale changes the job and how we approach design.`
- CTA: `Our design philosophy`

## Responsive Behavior
- **Desktop (1440px):** oversized ring dominates viewport; manifesto sits in two-column grid
- **Tablet/Mobile:** manifesto collapses to centered single-column content, ring size adjusts through `--ring-size`
