# Footer Specification

## Overview
- **Target file:** `public/shopify-design/index.html`
- **Screenshot:** `docs/design-references/shopify.design/footer-original.png`
- **Interaction model:** static + CTA hover

## DOM Structure
- `footer.site-footer`
  - `.site-footer-top`
  - `hr.site-footer-rule`
  - `.site-footer-body`

## Computed Styles

### Footer
- `display: flex`
- `flex-direction: column`
- `padding: 0 var(--footer-gutter) 164px`

### Top Row
- `display: flex`
- `align-items: center`
- `justify-content: space-between`
- `padding: 20px 0`

### Title / Year
- `font-family: var(--font-mono)`
- `font-size: var(--text-meta)`
- `text-transform: uppercase`
- `letter-spacing: .02em`

### Headline
- `font-family: var(--font-headline)`
- `font-weight: 500`
- `font-size: var(--text-heading)`
- `line-height: 1`
- `letter-spacing: -.03em`

## States & Behaviors
- CTA uses the shared pill hover animation

## Text Content
- `Shopify Design`
- `2026`
- `Help shape what comes next`
- `Join Shopify`
- `Open Roles`

## Responsive Behavior
- **Desktop (1440px):** left-aligned body content
- **Mobile (768px and below):** body content centers within a `360px` max width
