# Licensing and performance

## Third-party notices

- The skill's own instructions do not grant rights to third-party code, fonts, images, or reference artwork.
- p5.js is distributed under LGPL-2.1. When using or redistributing it, identify the exact version and source, preserve copyright and license notices, include the license text, and satisfy the applicable source/relinking obligations. Do not imply that generated original artwork itself becomes LGPL solely because it uses the library.
- For CDN use, record the exact URL and version. A CDN does not remove redistribution, notice, privacy, availability, or integrity considerations.
- For fonts, images, palettes, datasets, and other assets, record the creator/source, license, attribution requirements, modification restrictions, and redistribution terms. Bundle the applicable license when redistributing the resource.
- Prefer local system fonts or assets whose license has been verified. Do not assume a resource is reusable because it is publicly reachable.
- Do not use Anthropic or Claude names, logos, distinctive brand palette, proprietary font choices, or UI identity in generated work.

## Mobile performance budget

- Size the canvas from its container instead of fixing a 1200-by-1200 drawing buffer for every device.
- Cap effective pixel density, normally at `min(devicePixelRatio, 2)` and lower it when the algorithm is expensive.
- Begin with a conservative mobile particle budget, usually 20–40% of the desktop count, then adapt based on measured frame time.
- Avoid per-frame allocation, repeated full-array reconstruction, unbounded trails, synchronous generation of large seed galleries, and unnecessary square roots or trigonometry in inner loops.
- Pause animation on `visibilitychange`, when the component is offscreen if practical, and when reduced motion is requested. Resume only when appropriate.
- Debounce expensive slider-driven regeneration. Keep lightweight visual adjustments immediate when safe.
- Prefer `noLoop()` and explicit `redraw()` for static tattoo compositions.
- When generating many variants, batch work across frames or use a worker if compatible with the rendering design. Do not freeze the main thread.
- Treat smoothness claims as unverified until tested on representative mobile hardware.
