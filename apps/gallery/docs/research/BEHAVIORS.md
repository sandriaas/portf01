# Shopify Design Homepage Behaviors

## Global
- Fonts:
  - `AntiqueLegacy` weights `300`, `400`, `500`
  - `FragmentMono` regular
- Core tokens:
  - `--color-black: #000`
  - `--color-body: #1A1A1A`
  - `--color-red: #FE432A`
  - `--color-green: #6BFF91`
  - `--color-border: #e6e6e6`
- Motion curves:
  - `--ease-out-expo: cubic-bezier(.16, 1, .3, 1)`
  - `--ease-spring-bouncy: linear(...)`
  - `--ease-spring-medium: linear(...)`

## Header
- Intro: `.site-header` animates from `top: -40px; opacity: 0` to visible through `header-in`
- CTA hover:
  - `.button-row:hover .btn-pill` scales to `1.015`
  - icon pill runs `arrow-nudge` animation

## Hero
- Section rise: `.hero` animates with `hero-rise`
- Live bar reveal:
  - class `tagline-in`
  - `clip-path` reveal from right to left
- Live dot:
  - green pulse via `livePulse` infinite animation
- Grid cards:
  - entrance via `card-slide-in`
  - hover on static cards: `scale(1.015)` + `--shadow-card-hover`
  - active press: `scale(.97)`
  - posters fade once runtime marks `data-video-state=ready`

## Countdown / Manifesto
- Section uses `height: 600vh` sticky scroll stage
- Sticky container: `.countdown-stage-sticky { position: sticky; top: 0; height: 100dvh; }`
- Main visual is a large circular ring plus countdown digits
- Manifesto CTA remains within the scroll composition and becomes part of the sticky scene

## Carousel
- Cards enter with translated / scaled staggered animation when container gains `carousel-container-entered`
- Container scroll:
  - horizontal overflow
  - `scroll-snap-type: x mandatory`
  - hidden scrollbars
- Hover motion:
  - shell scales to `1.015`
  - media stack images fan outward further on hover
  - background text shifts left/right on hover
- Click behavior:
  - cards open modal overlay
  - hash-routing observed locally, for example `#context`

## Remote
- Large headline pieces use same reveal language as other display text
- Studio thumbnail hover:
  - `transform: scale(1.03)`
  - `box-shadow: 0 0 20px #0003`

## Modal
- Backdrop fades in with blur
- Card animates from `opacity: 0; filter: blur(3px); transform: scale(1.05)` to visible
- Close affordance is a floating circular cursor on desktop and bottom-fixed button on mobile

## Responsive
- Primary breakpoint: `768px`
- Mobile changes:
  - smaller logo
  - CTA compresses / hides date and icon
  - hero grid card radius drops to `12px`
  - carousel width and bleed reduce
  - remote typography stacks into a single-column rhythm
  - footer centers content
