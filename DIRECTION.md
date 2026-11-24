# Meridian — Design Direction

**Concept:** `SCROLL IS TIME`  
**One-line:** The page is a 14-day ensemble run, not a website tour. Every scroll moves the forecast one day closer to a decision.

## Thesis

Meridian’s subject is not “weather” in general; it is **uncertainty becoming a decision**. A forecast is fifty-one possible futures spread across fourteen days, and the product’s value is seeing the spread before it becomes a cost. The site must make that visible before it explains it.

So the page is structured as a single forecast briefing that runs from 14 days to impact (`T−14`) down to impact (`T−0`). Scroll does not move through eight marketing sections; it advances time. A single persistent day rail is the organising device for the whole experience: it controls the globe, the ensemble, the copy, the lane risk, the desk notes, and the final horizon choice. Sections become chapters in one continuous run rather than separate cards.

The memorable image is not a beautiful globe. It is the **ensemble fan**: fifty-one fine trajectories leaving the same origin, spreading while confidence is low, converging into one selected route as time runs out. The globe is the surface this happens on, not the protagonist.

## Time model

Rail time is the **countdown to impact**, not elapsed narrative time. The page opens at `T−14` with fourteen days still available and ends at `T−0`; the ensemble spread is widest at `T−14` and collapses toward the realised outcome as the run sharpens. The hero fan performs the only “opening” animation: at fixed `T−14`, it expands from a single central path to maximum spread over roughly 1.6 seconds, then scroll alone consumes the remaining days and collapses it. One normalised variable, `uDay` (`0` at `T−14`, `1` at `T−0`), drives the rail, storm position, copy state, risk values, drawn track length, and spread. At `T−0` the 51 futures become one path: member 17. The rail renders this as “days to impact”; pricing never uses this notation and speaks only of “3-, 7-, or 14-day lead”.

```text
              storm genesis · 34.2°N 38.7°W
                         ●
                       / | \
        T−14  spread 1.00  ─────  intro opens · 51 futures
         T−7  spread 0.55  ────  uncertainty narrows
         T−0  spread 0.00  ───●  realised path · member 17
```

**Fan geometry.** All 51 tracks start at the storm genesis point on the globe (`34.2°N 38.7°W`, radius `R = 2.0`), share the same central trajectory toward the impact point, and diverge tangentially around it. Each track is a 7-control-point cubic curve resampled to 64 segments, lifted radially `0.015–0.05` above the sphere surface so it never z-fights the globe dots. All 51 tracks live in one `LineSegments` `BufferGeometry` (`51 × 64 × 2 = 6,528` vertices) and render in **one draw call**; member 17 is highlighted to bone `#f2eee6` through a per-vertex colour attribute, while the other 50 stay dim cyan at low alpha. The highlighted member is the realised track, not a separate object or second draw call.

The shader receives `uDay`, `uSpread = (1 − uDay)^1.2`, and `uLength = 0.55 + 0.45 * easeOut(uDay)`: at `T−14` the fan is at maximum width but only part of the trajectory is drawn; it lengthens and converges until `T−0` reveals the full path. The intro tween runs `uSpread` from `0 → 1` and `uLength` from `0 → 0.55`; after that, scroll is the only driver. No section restarts the fan.

## Forecast program

The current section order is a familiar funnel. Re-sequence it around a run in progress, with the day rail as the source of order and labels.

| Days to impact | Section    | Chapter role                                  | Visual state                                                     |
| -------------- | ---------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `T−14–T−12`   | `hero`     | The futures open                              | 51 tracks fan across the globe; one horizon marker; no full-width brand wordmark |
| `T−11–T−9`   | `problem`  | Uncertainty becomes cost                      | storm grows on the globe; copy reveals only what is known by that day |
| `T−9–T−7`   | `method`   | Resolve the ensemble                          | one continuous instrument: ingest → resolve → reroute on the same rail |
| `T−7–T−5`   | `signals`  | Calibration check                             | a horizontal measurement strip tied to day ticks, not a 2×2 stat grid |
| `T−5–T−3`   | `routes`   | One lane bends                                | 51 member tracks cross one lane; one route bends around the storm       |
| `T−3–T−2`   | `gallery`  | Evidence plates                               | four authored forecast artifacts at different scales and materials      |
| `T−2–T−1`   | `voices`   | Desk transmissions                            | quotes pinned to coordinates and days, read as field transmissions      |
| `T−1–T−0`   | `pricing`  | Choose the decision lead                      | 3-day / 7-day / 14-day lead control changes the offer; final commitment   |
| `T−0`        | `footer`   | Forecast issued                               | a forecast slip / booking receipt, not another brand wordmark           |

Preserve the existing URL anchors (`#hero`, `#problem`, `#routes`, etc.), but stop printing `01 / 02 / 03` section indices. The meaningful label is **days to impact**. Nav and menu should show the days and chapter names, never the words “D3 / D7 / D14”.

## Five signature moments

### 1. First light — the fan opens (`hero`, `T−14`)

On load, the globe assembles as it does today, then 51 fine trajectories expand from the storm genesis toward the `T−14` horizon. Member 17 is bone; the other 50 are dim cyan. The fan is the hero image. The headline and lede sit inside the fan’s negative space rather than beside a sphere. The wordmark becomes a small lockup in the nav; it is not the bottom-third spectacle. The fan reaches maximum spread once, then scroll collapses it according to the time model above.

### 2. The rail advances (`global`)

A persistent **days-to-impact rail** (`T−14 → T−0`) sits in the left page margin on desktop and becomes a slim horizontal rail beneath the nav on mobile. The active day is visible at all times. Scrolling smoothly advances the countdown, moves the storm system, tightens the ensemble spread, updates risk values, and changes section state. This is not a progress bar; it is the page’s clock. Sections are positions on the countdown, and navigation can jump to a day as well as a section.

### 3. Member 17 bends (`routes`, `T−5`)

The lane view becomes the interactive proof. Select a lane, then scrub the countdown: the 51 member tracks cross the same geography, the spread narrows, and member 17 peels away around the storm. The old passage becomes a dashed ghost; the new passage builds. Risk, ETA, and cost resolve from the same data. The user sees why the route moves before the copy tells them.

### 4. Atlas of evidence (`gallery` + `voices`, `T−3–T−1`)

Field notes stop being four equal cards. Build a forecast atlas of four artifacts with different physical logic: an isobar tracing, a berth queue strip, a folded passage plan, a fleet clock. Each carries a days-to-impact stamp, a coordinate, and a source line. One plate is a bone-paper forecast slip on the night field: a deliberate material inversion, made from CSS/SVG only. Voices are docked to the atlas as desk transmissions, each tied to a coordinate and a decision; no generic testimonial carousel.

### 5. Horizon selected (`pricing` + `footer`, `T−1–T−0`)

Pricing is the final act of the forecast, not a card grid. A **3-day / 7-day / 14-day lead** control sits beside the rail. Moving it changes decision lead, coverage, plan language, and CTA, while the first selected lead becomes the natural default. The page ends with an issued forecast slip: forecast ID, chosen lead, desk time, and the request action. It should feel like leaving the model room with a document, not seeing the logo again.

## Typography

Keep only Bricolage Grotesque and IBM Plex Mono. Make the scale do the hierarchy work; stop using monospace caps as decoration.

| Token              | Size                                        | Use                                                              |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------- |
| `--type-display`   | `clamp(4rem, 10vw, 11.5rem)`                | One informational display per page (hero numeral / active day), not the brand |
| `--type-statement` | `clamp(2.6rem, 4.8vw, 5.4rem)`              | Section statements; line-height `0.94`, tracking `-0.045em`       |
| `--type-title`     | `clamp(1.4rem, 2vw, 2.1rem)`                | Step, plate, and plan titles; line-height `1.05`                  |
| `--type-body`      | `clamp(1rem, 0.95rem + 0.4vw, 1.25rem)`     | Max `58ch`; line-height `1.55`; color `--muted` or `--ink-dim`    |
| `--type-data`      | `clamp(0.75rem, 0.72rem + 0.12vw, 0.82rem)` | Mono only for coordinates, units, day ticks, source lines         |
| `--type-day`       | `clamp(0.8rem, 0.75rem + 0.2vw, 0.95rem)`   | Tabular day numbers and labels; active day gets weight, not colour alone |

Rules:

- Use `font-variant-numeric: tabular-nums` for days, risk, ETA, and coordinates.
- No all-caps eyebrows on narrative sections. `14 DAYS TO IMPACT / NORTH ATLANTIC` is data, so mono caps are allowed there.
- No `A · B · C` metadata strings unless each item is a real coordinate-style datum.
- Tight display leading, roomy body leading, no line longer than roughly 62 characters.
- `text-wrap: balance` on headings, `pretty` on paragraphs.

## Colour and material

The palette stays derived from the subject: night ocean, warm bone, live cyan. It becomes semantic rather than decorative.

| Role        | Value     | Job                                                              |
| ----------- | --------- | ---------------------------------------------------------------- |
| `--bg`      | `#05070d` | Deep-ocean night; 75–85% of the page                              |
| `--surface` | `#090d16` | Instrument recess; only behind real controls                      |
| `--ink`     | `#f2eee6` | Primary type and bone contour lines                               |
| `--muted`   | `#a6b0c2` | Secondary copy                                                   |
| `--accent`  | `#7fe7ff` | Live measurement, active day, selected member; ≤8% of pixels      |
| `--caution` | `#e0bd7a` | Elevated risk only; paired with line weight or pattern            |
| `--alarm`   | `#e57655` | Severe risk only; never used as a decorative accent               |
| `--slip`    | `#e7dfcf` | One forecast-slip material inversion only                         |

No purple/blue gradient wash, no second neon, no colour-only risk encoding. Risk reads through value plus stroke density plus a written label.

## Grid and composition

- Base: 12 columns, `--pad` page margin, `--gutter` gap. Add a desktop-only `56–72px` day-rail column outside the 12-grid; content aligns to the rail’s right edge.
- Vary alignment by chapter: statement-led hero, evidence-led problem, instrument-led method, full-bleed lane fan, wide atlas, decision-led pricing. Do not repeat “heading left / lede right” in every section.
- Use three widths deliberately: **narrow** (42–58ch statement), **instrument** (wide chart or rail), **full bleed** (atmosphere or fan). Alternate them to create rhythm.
- The rail becomes a top sticky strip of 30px on mobile; no floating cyclone label may cover the section index, copy, or controls. A section must never depend on an overlay for orientation.
- Single-column reading order on mobile; asymmetry collapses to sequence, not a maze.

## Mobile translation

At `390×844` the page is re-authored, not shrunk. The nav is 56px and the days-to-impact rail is 30px, so the entire sticky header is **86px** (under the 100px ceiling; at 320px it is 82px). Desktop exposes all fifteen day ticks; at 390 the rail condenses to its nine chapter stops (`14, 11, 9, 7, 5, 3, 2, 1, 0`) plus a live current-day badge, so the strip never has sub-24px targets or horizontal page overflow. Every visible cell is a real `<a>` to its chapter, with a 30px hit height, `touch-action: manipulation`, current focus, and an accessible label such as “11 days to impact”.

Use `100svh` for section minimums so mobile browser chrome does not jump the composition, and `dvh` only for viewport-driven canvas/camera maths, never for layout, copy, CTA, or rail height. Reserve a fixed `--chrome-h` for scroll margins; `scroll-margin-top: calc(var(--chrome-h) + 12px)` keeps a tapped chapter clear of the sticky header. No pinned section may crop a 390px CTA or its last text line.

The five moments translate as follows:

- **Fan:** globe moves to the lower half, track fan is clipped inside the upper viewport behind a copy scrim; 51 tracks remain, 32 segments on low tier. No controls are hidden under the fan.
- **Route bend:** no hover dependency. Lane rows become wrapping 48px buttons, and the countdown rail is the scrub control: tap 5 days to impact, watch member 17 bend. The 51-track view stays full-width with no fixed dashboard panel covering the globe.
- **Transmissions:** voices stack vertically at full width; no clipped third card, no hover-only reveal. Prev/next remains as 44px buttons with visible count and live announcement.
- **Horizon control:** 3-day / 7-day / 14-day lead is a three-segment control with 48px targets, full width, changing coverage and CTA in place. No three-column plan cards at 390.
- **Overlays:** storm label is suppressed on coarse pointers; day rail, nav, and controls never overlap body copy. Fixed overlays are limited to the 86px header; everything else scrolls in normal flow.

## Performance budget

The concept fixes the member count: **all 51 tracks stay visible on every tier**, because the ensemble is the idea. Quality changes tessellation, pixels, and effects — never the number of futures. Tracks are one `LineSegments` draw call on all tiers.

| Tier       | Starting condition                              | Tracks | Segments / track | Vertices | Max DPR |
| ---------- | ----------------------------------------------- | ------ | ---------------- | -------- | ------- |
| High       | fine pointer, ≥1024px                            | 51     | 64               | 6,528    | 2.0     |
| Balanced   | tablet / narrow desktop                         | 51     | 48               | 4,896    | 1.5     |
| Low        | coarse pointer, <720px, or `deviceMemory ≤ 4`   | 51     | 32               | 3,264    | 1.25    |

- Initial JavaScript target: **≤215 KB gzip** (the current production build is ~203 KB gzip). U1a and U1b may not add libraries; any overage must come out of dead code first. Initial CSS stays ≤15 KB gzip.
- Frame-time threshold: a rolling one-second average above **20 ms** for two consecutive windows is “over budget”. Step down one tier (disable the most expensive pass first, then reduce DPR, then segment count); never remove members. Restore quality only after ten stable seconds below 14 ms, at most one step per six seconds.
- Pause rendering when the page is hidden or the WebGL canvas is offscreen; do not update rail/ensemble time while paused.
- Budget the rest of the scene at <100 draw calls desktop / <50 mobile, and do not allocate vectors, arrays, or geometry per frame.

## Motion

- One master scroll timeline maps page progress to forecast day. It drives the rail, globe storm position, ensemble spread, route risk, and section handoffs. Do not create eight unrelated reveal timelines.
- Motion hierarchy:
  - **Level 1:** input feedback, 120–220ms, `ease-out`.
  - **Level 2:** section handoff, 500–750ms, `expoOut`.
  - **Level 3:** the hero opening and the route bend, 900–1600ms, authored.
- No repeated fade-and-slide-up on every section. Use clip-path cuts, track convergence, day ticks, and one pinned lane sequence where the action needs it.
- The custom cursor survives only on fine pointers and becomes a forecast probe: it can read `8 DAYS TO IMPACT / MEMBER 17` over a chart, and grows slightly over controls. It never hides the native cursor on touch or keyboard use.
- `prefers-reduced-motion`: rail jumps between days; content is fully visible; globe holds a static forecast state; no scroll-scrub dependency. All interaction remains usable with keyboard.

## System rules

- Preserve the copy’s specificity and voice. Rewrite labels, not the argument. Every number keeps a unit and a source context.
- No new libraries, no external images, no stock photography, no additional typeface. All new textures, plates, slips, and fans are generated from CSS, SVG, or WebGL.
- Every visual must be traceable to forecast data: day, member, lane, station, or source. Decorative grid lines may remain only when they read as a chart.
- Global section index eyebrows disappear. The day rail replaces them.
- Keep the skip link, focus-visible states, live announcements, keyboard controls, reduced-motion path, and the existing preloader/GL failure path.
- Keep page anchors stable. A reorder should update labels, not break inbound links.

## Files likely to change

| Area               | Files                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Section model      | `src/lib/sections.ts` — add `dayStart`, `dayEnd`, forecast chapter labels, new order; keep IDs          |
| Day system         | new `src/ui/dayRail.ts`; `src/main.ts`; `src/lib/scroll.ts`; new `src/styles/time.css`                   |
| Tokens and type    | `src/styles/tokens.css` — type scale, rail, risk and slip roles                                        |
| Hero / ensemble    | `src/styles/hero.css`, `index.html`, new `src/webgl/ensemble.ts`, `src/webgl/Globe.ts`, `src/main.ts`    |
| Globe and weather  | `src/webgl/Scene.ts`, `src/webgl/storm.ts`, `src/webgl/routes.ts`, `src/webgl/shaders.ts`                |
| Chapter layouts    | `index.html`; `src/styles/content.css`, `choreo.css`, `phase4.css`; relevant `src/ui/*` modules          |
| Interaction states | `src/ui/routes.ts`, `src/ui/gallery.ts`, `src/ui/voices.ts`, `src/ui/pricing.ts`, `src/ui/footer.ts`      |
| Chrome and finish  | `src/ui/nav.ts`, `src/ui/hud.ts`, `src/ui/cursor.ts`, `src/ui/transition.ts`, `src/ui/preloader.ts`      |
| Structure / SEO    | `index.html`, `public/` metadata assets and sitemap/robots in U4                                      |

## Success test

At the end of U5, the following should be true:

1. After five seconds on the hero, a visitor can say: “51 possible futures, 14 days, and I choose a horizon.”
2. Removing the Meridian wordmark still leaves an unmistakably Meridian page: ensemble fan, day rail, live globe, forecast instruments.
3. A captured frame at T−14, midpoint, and T−0 looks like three states of the same run, not three unrelated marketing pages.
4. Mobile at 390px has no overlay covering copy or controls, no horizontal page overflow, and the rail still communicates the current day.
5. With reduced motion on, every section is readable, every control works, and the forecast remains legible without scrub animation.
