# Meridian — Glitches

**Last updated:** 2026-11-25  
**Live site:** https://meridian-nine-eosin.vercel.app/  
**Live commit at review:** `8aacb6eac51510147130799b3ffaf40a1eaaaee4`  
**Scope:** Part A contains the production-review fixes implemented in this pass. Part B is the next interaction direction and lives in `DIRECTION.md`.

## Part A — Fixed in this pass

| ID | Glitch | Fix | Status | Evidence / files |
| --- | --- | --- | --- | --- |
| A1 | Header coordinates were hard-coded London values and did not track the globe. | Replaced the viewport-to-lat/lon approximation with a camera raycast against the globe sphere (`R = 2.0`), transformed into globe-local space. Origin labels are generated from `ENSEMBLE_ORIGIN`; the hero readout updates only when the pointer intersects the surface. | Fixed | `src/webgl/Scene.ts` (`getSurfaceCoordinate`), `src/ui/coordinates.ts`, `src/main.ts`; browser check returned `5.05°S 63.02°W` at `(900, 430)` and `34.20°N 38.70°W` at rest. |
| A2 | Copy had typos and awkward phrasing. | `fold into one field` → `feed one field`; `ENSEMBLE 51` → `51 MEMBERS`; `Side to scroll` → `Scroll sideways`; coordinate formatting normalized to `34.20°N 38.70°W`. | Fixed | `index.html` |
| A3 | `3,842 active lanes` was visually confusable with `38,412 assets`; chart `NOW / DAY 05` did not distinguish current risk from peak risk. | Lane count changed to `9,204`; each lane row now reads `Now 34% · peak 58%` (and equivalents); chart label reads `NOW · DAY 05`; chart title/announcement state current and peak risk. | Fixed | `index.html`, `src/ui/routes.ts`; rows render `Now 34% · peak 58%`, `Now 61% · peak 72%`, `Now 52% · peak 61%`. |
| A4 | Pricing mixed USD per tier with inconsistent periods; Command used `/ annual`. | Removed per-tier `USD`; all tiers now use a monthly period. One note covers currency, seat/fleet basis, custom quote, and included run. | Fixed | `index.html`; prices render `0 / seat / month`, `1,900 / fleet / month`, `Custom / month`. |
| A5 | `NEXT RUN` was static (`03 H 12 M`) and could not reflect the actual 00/06/12/18 UTC schedule. | Added a UTC clock driven by 6-hour Unix slots. Next-run countdown updates every second; hero model-run time shows the most recent UTC run. | Fixed | `src/ui/forecastClock.ts`, `src/main.ts`; verified output `NEXT RUN IN 01 H 43 M 00 S / 51 MEMBERS READY` with `Model run / 06:00 UTC`. |
| A6 | Preloader’s decorative text was exposed to assistive tech; removal needed proving. | Marked preloader head/body/foot visual blocks `aria-hidden` while retaining the root status label. Existing timeline still removes the node after completion and immediately under reduced motion. | Fixed | `index.html`, `src/ui/preloader.ts`; normal and `prefers-reduced-motion` browser checks both reported `#preloader` count `0`. |
| A7 | No canonical, social preview, favicon, or touch icon assets. | Added canonical URL, Open Graph/Twitter metadata, SVG + 32/192 PNG favicons, 180px Apple touch icon, and a 1200×630 OG capture. | Fixed | `index.html`, `public/favicon.svg`, `public/favicon-32.png`, `public/favicon-192.png`, `public/apple-touch-icon.png`, `public/og-image.png`. |
| A8 | HTML source order disagreed with the runtime section order (`routes` was authored before `method`); the globe veil began at `#method`, hiding the planet before the lane view. | Moved the `routes` block after `signals` in source. Retimed the veil to begin as `#gallery` enters, so the globe remains present through `routes`. | Fixed | `index.html`, `src/lib/scroll.ts`; live DOM order verified hero → problem → method → signals → routes → gallery → voices → pricing; 1440px routes capture shows globe and ensemble still visible. |

## Copy proofread log

| Before | After | Location |
| --- | --- | --- |
| Four decades … fold into one field every six hours | Four decades … feed one field every six hours | Method / Ingest |
| RISK SCORES UPDATE EVERY 6 HOURS / ENSEMBLE 51 | RISK SCORES UPDATE EVERY 6 HOURS / 51 MEMBERS | Routes note |
| Side to scroll / four plates | Scroll sideways / four plates | Gallery foot |
| Risk 34% | Now 34% · peak 58% | Route R1 |
| Risk 61% | Now 61% · peak 72% | Route R2 |
| Risk 52% | Now 52% · peak 61% | Route R3 |
| NOW / DAY 05 | NOW · DAY 05 | Risk chart |
| All 3,842 active lanes | All 9,204 active lanes | Route plan |
| 0 USD / seat / month | 0 / seat / month | Watch plan |
| 1,900 USD / fleet / month | 1,900 / fleet / month | Route plan |
| Custom / annual | Custom / month | Command plan |
| Prices in USD. Every plan includes… | Prices in USD, billed monthly… | Pricing foot |

## Verification

- Typecheck: `npx @typescript/native-preview -p tsconfig.json --noEmit` completed with no diagnostics. The local TypeScript 5.9 CLI hangs in this environment; `node node_modules/vite/bin/vite.js build` is the working build path here.
- Production build: Vite `8.3.8`, 62 modules transformed, built successfully. Built HTML: `dist/index.html`; built assets include `index-CvAx8UoG.js`, `index-BjsBuZxs.css`, `three-qdFa4BKU.js`, `gsap-Cl0OKwb9.js`, `lenis-DYAF5LSz.js`, `three-addons-BMOhCCPG.js`.
- Desktop verification at 1440×900: no console/page errors; preloader removed; globe coordinates update on pointer; clock, chart labels, row labels, pricing, and section copy all render as intended.
- Mobile verification at 390×844: no horizontal overflow (`scrollWidth === clientWidth === 390`); no console/page errors; preloader removed; reduced-motion path verified.
- OG image verified at 1200×630 and reviewed visually; it shows the day rail, hero headline, globe, ensemble, and live coordinates.
- The live Vercel alias still serves the previously deployed commit `8aacb6e`; this pass changed the working tree and production preview only. No deployment was performed.

## Part B

The next five interactions are documented in `DIRECTION.md` under **Part B — Production review additions**: preloader-as-ensemble, storm seeding, the member-17 bend, keyboard time controls, and the in-site forecast request flow.
