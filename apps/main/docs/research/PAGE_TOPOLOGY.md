# Page topology — x29.ai homepage

| order | id       | selector                            | parent layout                                              | interaction model |
|-------|----------|-------------------------------------|------------------------------------------------------------|-------------------|
| 0     | nav      | `.master-navigation`                | fixed-ish wrapper, sits above hero                         | Webflow IX3 (no per-section override)            |
| 1     | hero     | `section.hero-home-section`         | full-bleed; first flow item                                | static autoplay video (overridden locally)       |
| 2     | overlap  | `section.home-overlap-section`      | follows hero; sticky inner copy                             | scroll-driven slider w/ Webflow tabs               |
| 3     | work     | `section.home-work-section`         | marquee + project cards                                    | scroll/marquee + hover                              |
| 4     | services | `section.home-services-section`    | grid                                                        | static + hover                                      |
| 5     | video    | `section.home-video-section`        | full-bleed background-video                                 | autoplay video (Webflow CDN-served)                 |
| 6     | numbers  | `section.home-numbers-section`      | grid w/ counters                                            | scroll-triggered count-up (Webflow IX3)             |
| 7     | footer   | `.footer`                           | last flow item                                              | autoplay background video + marquee                  |

Ancillary layers: `.sales-cta-master`, `.sales-menu`, `.bg-dots`, `.master-footer-content`.

The DOM is the upstream Webflow body served from `src/content/x29/pages/home.body.html`. Only the hero is rewritten by `applyX29HomeHeroOverride()` in `src/lib/x29-home-hero.ts`. Every other section is byte-identical to live (proxied assets via `src/app/x29/cdn.prod.website-files.com/[...path]/route.ts`).
