# X29.ai Homepage Behaviors

## Runtime classes
- `w-mod-js` is applied immediately from the inline head bootstrap.
- `w-mod-ix` is added by Webflow once base interactions initialize.
- `w-mod-ix3` is required for the hero video, nav animation, marquee text, and several reveal elements to become visible.
- The local clone must execute the original body-end scripts in order; client-side script injection was not sufficient for `w-mod-ix3`.

## Navigation
- Fixed top nav with animated open/close menu button.
- Mobile and desktop both depend on Webflow nav behavior classes.
- CTA and nav links preserve original destinations by absolute linking back to `https://www.x29.ai/...`.

## Media behaviors
- Hero uses autoplaying, muted background video.
- Footer uses a second autoplaying, muted background video.
- Both video wrappers remain hidden until the `w-mod-ix3` state is reached.

## Slider / carousel behaviors
- Overlap image carousel auto-advances with Webflow slider timing.
- Journal section uses slider arrows and a hidden numeric nav.
- Slider images include overlay marks that remain positioned over the active media.

## Hover / motion behaviors
- CTA buttons animate their background layer and text mask.
- Service list rows animate border states on hover.
- Journal/article cards scale image content on hover.
- Footer CTA underline and overlay respond to hover.

## Scroll-driven behaviors
- The page transitions between light and dark section palettes as you move down the layout.
- Several text and image groups are hidden until interaction state completes, then animate in.
- Desktop and mobile both rely on the same script stack, but mobile boot can take slightly longer in dev mode before `w-mod-ix3` appears.
