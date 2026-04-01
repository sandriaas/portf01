# X29.ai Homepage Topology

## Global structure
- Fixed overlay nav: `.nav-wrap-animation`
- Flow content begins after the nav and is composed of eight primary sections plus the hidden sales menu overlay
- Footer is a full-height media section with an autoplay background video

## Section order
1. `section.hero-home-section`
   - Full-height hero
   - Background video
   - Primary H1 and CTA
   - Small two-column label row at the bottom
2. `section.home-overlap-section`
   - Introductory serif statement
   - Circular image slider with overlaid X29 mark
3. `section.home-work-section`
   - Long-form narrative blocks
   - Alternating image and text groupings
   - Dark theme section
4. `section.home-services-section`
   - "What we do" list
   - Four service rows with linked detail states and hover media
5. `section.home-video-section`
   - Full-width CTA / story section
   - Autoplay background video with headline and CTA
6. `section.home-numbers-section`
   - Three metrics in a horizontal strip
7. `section.home-slider-section`
   - Journal carousel
   - Multiple card slides with arrows
8. `div.sales-cta-master`
   - Hidden overlay sales menu for additional site pages
9. `section.footer`
   - Autoplay background video
   - Two-line CTA
   - Footer logo and meta copy

## Layering notes
- The nav is visually independent of the hero and sits as an overlay.
- Hero and footer both rely on autoplay video layers beneath text content.
- The overlap section uses stacked image treatments: base imagery plus circular logo overlays.
- The journal section includes embedded inline SVG arrow controls and slider nav state.
