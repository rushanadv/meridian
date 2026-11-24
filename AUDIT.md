# Meridian — U0 Design Audit

**Date:** 2026-11-24  
**Auditor:** U0 design lead pass  
**Live build:** http://localhost:5173/  
**Evidence:** `docs/u0/` — 9 desktop captures at 1440×900 and 9 mobile captures at 390×844, plus true-touch mobile checks and source review.  
**Scope:** visual direction, composition, hierarchy, narrative, and interaction cues. This is not a formal accessibility or performance audit.

The site is already coherent and competently built. The globe, copy voice, dark atmosphere, and typographic base give us a strong foundation. The weakness is not polish; it is that most sections still resolve into familiar landing-page patterns instead of making Meridian’s unusual premise — **fifty-one possible futures moving toward one decision** — visible in the interface.

## Phase 2 visual-fix verification

- **Text over globe:** partial. The hero, method, and signals scrims hold on desktop. At 390px the problem statement still sits over the globe at its initial 20% reveal opacity and is difficult to read until the pinned scrub advances.
- **Panels cutting the canvas:** not fully landed. The lane panel remains a hard rectangular fill that cuts across the globe on both desktop and mobile, and at 390px it obscures most of the visible map.
- **Nav smudges:** landed. The current nav gradient and scroll state are clean at 1440×900 and 390×844; no overlapping type or gradient banding found.
- **Mobile cyclone label:** landed on actual touch. `@media (hover: none)` sets the label to `display: none`; `docs/u0/phase2-check-touch-*.png` confirms it is absent. The original 390px capture used a mouse-like pointer, which is why the overlay appeared there and should not be treated as the mobile result.

## Ten weakest / most template-looking points

### 1. Hero: the premise is absent from the first screen

**Where:** `index.html:106–146`, `src/styles/hero.css:51–108`; `desktop-00-hero.jpg`, `mobile-00-hero.jpg`  
**What we see:** a single pristine globe, a three-line SaaS-style headline, and a giant `MERIDIAN` wordmark. The first screen communicates “weather intelligence” but not “51 possible futures” or “scroll is time.” The worldmark is the largest object on the page; the actual differentiator is reduced to a small `14-DAY HORIZON / MODEL 0.9` tag.  
**Why it reads generic:** “large left headline + 3D sphere on the right + oversized brand wordmark + scroll prompt” is the default premium-tech landing composition. It could serve a satellite company, a climate startup, or a analytics platform.  
**Direction:** replace the wordmark as the hero’s terminal gesture with the ensemble itself. Show 51 fine trajectories opening from one horizon line; one solid path, fifty ghosted possibilities. The existing globe becomes the substrate, not the whole idea.

### 2. Problem: a pinned paragraph and a metadata card do most of the work

**Where:** `index.html:148–236`, `src/styles/choreo.css:69+`; `desktop-problem.jpg`, `mobile-problem.jpg`  
**What we see:** a very large statement, three cyan keywords, a 4-row data panel, three tiny state tabs. The copy is excellent, but the section is an animated reading slide. At entry the words sit at 20% opacity, so the first impression is a huge dim paragraph. On mobile the floating cyclone label covers the section index and a large part of the globe, making the state harder to read.  
**Why it reads generic:** “big manifesto sentence + accent words + mono data card” is the standard editorial-SaaS treatment. The visual does not turn the cost of a late forecast into a consequence.  
**Direction:** make the section a forecast event, not a quote: the storm should visibly intensify along the day rail, while the copy reveals only what the current day knows. Numbers should attach to the lane or vessel affected, not sit in a detached panel.

### 3. Lane View: a dashboard panel pasted over the hero composition

**Where:** `index.html:238–376`, `src/styles/choreo.css:249+`; `desktop-routes.jpg`, `mobile-routes.jpg`  
**What we see:** left copy, central globe, a right-hand lane selector with three table rows and a single-line risk chart. The chart has no visible 14-day axis, no ensemble spread, and no text showing what changed between members. On mobile the panel occupies most of the viewport and buries the globe behind it.  
**Why it reads generic:** this is a “analytics dashboard in a marketing page” pattern: rows, percentage labels, sparkline, rounded box. The interface looks like it is reporting a certain future, which contradicts the product’s premise.  
**Direction:** make this the one lane-level moment where 51 futures become legible: a fan of member tracks crossing the same lane, one selected member bending around a storm, risk and ETA changing as the day scrubber moves. The user should be able to see uncertainty before selecting a lane, not after.

### 4. Method: three equal feature rows with miniature stock diagrams

**Where:** `index.html:377–527`, `src/styles/content.css:80–176`; `desktop-method.jpg`, `mobile-method.jpg`  
**What we see:** three stacked rows, each with a mono step label, copy left, decorative SVG right, separated by hairlines. The sequence is real, so the numbering is legitimate, but the layout is still the default “how it works” list. The three diagrams look like the same line-art system at three sizes and do not connect to the globe or the time rail. The section spans 1800px, two full screens, without a change in rhythm.  
**Why it reads generic:** the reader learns the process from prose and tiny illustrations rather than from a simulation. Any climate or SaaS product could use these rows with new words.  
**Direction:** treat the three moves as three time cuts on the same ensemble: ingest, resolve, reroute. The visual should persist across all three, with the fan tightening, the map resolving, and one route peeling away. One continuous instrument rather than three unrelated diagrams.

### 5. Signals: “four big numbers” is the most overt SaaS stat slab

**Where:** `index.html:529–590`, `src/styles/content.css:251–330`; `desktop-signals.jpg`, `mobile-signals.jpg`  
**What we see:** a 2×2 grid of enormous numerals with tiny mono units. `14`, `51`, `38,412`, `92` repeat figures already introduced elsewhere. The headline “The model, in four numbers” makes a virtue of a default layout. The values have no physical scale, provenance, or time relationship; the block reads as proof-by-typography.  
**Why it reads generic:** the large-stat grid is the standard “credibility band” on every modern B2B site. It adds size without adding meaning.  
**Direction:** rework signals into a calibration strip on the day rail: each value sits at the day it becomes knowable, with a tiny ensemble spread or uncertainty mark. Keep numbers, but make them measurements inside the forecast, not cards outside it. The four values may stay, but they should obey one instrument logic and share a time axis.

### 6. Field Notes: four equal cards in a horizontal carousel

**Where:** `index.html:591–857`, `src/styles/phase4.css:97–200`; `desktop-gallery.jpg`, `mobile-gallery.jpg`  
**What we see:** four identical cards with the same proportions, similar line-plot illustrations, the next card clipped at the edge, and a tiny “side to scroll” footer. “Field Notes” suggests a physical or editorial archive, but the result is a generic feature carousel. The notes also repeat the same visual system as the method and route charts.  
**Why it reads generic:** equal cards, identical metadata, and a carousel are the default way to show “features” or “case studies.” No material difference distinguishes one note from another.  
**Direction:** build a small forecast atlas instead: four evidence artifacts with different physical logic — an isobar tracing, a berth queue strip, a passage-plan fold, a fleet clock — unified by coordinates and day stamps, not by card chrome. Let one plate be a true material break, such as a bone forecast slip against the night field, generated in CSS/SVG (no external images).

### 7. Voices: social proof carousel unrelated to the forecast

**Where:** `index.html:859–989`, `src/styles/phase4.css:290–370`; `desktop-voices.jpg`, `mobile-voices.jpg`  
**What we see:** two equal quote cards with large quotation marks, mono attributions, a clipped third card, and Prev/Next buttons. The quotes are good, but they are presented in the universal testimonial carousel pattern. Nothing ties a voice to a place, a day, or a decision on the globe.  
**Why it reads generic:** testimonial carousel is a trust device imported from SaaS, not an experience native to a forecast desk. The design asks the reader to take the quotes on faith rather than letting the desk demonstrate its work.  
**Direction:** make the desk present at specific coordinates and days. Each voice becomes a brief transmission pinned to the forecast — for example, `D10 / 51.9°N 4.0°E / Northline`. The user can scrub between transmissions, but the quotes should feel overheard in the model room, not stacked as marketing cards.

### 8. Plans: a standard three-tier pricing table

**Where:** `index.html:991–1130`, `src/styles/phase4.css:429–560`; `desktop-pricing.jpg`, `mobile-pricing.jpg`  
**What we see:** three equal plan cards, a strengthened middle plan, `0 / 1,900 / Custom`, feature checklists, and a footer note. The page contains the strong idea “Pay for the horizon you need,” but the interface does not let anyone choose a horizon. It is a conventional SaaS pricing table wearing Meridian copy.  
**Why it reads generic:** three-column card grid with a “Most used” middle tier is one of the most recognizable generated-page patterns. The horizon is explained in copy but has no physical control.  
**Direction:** turn planning into the final forecast decision: a D3 / D7 / D14 horizon control that changes the offer, the coverage, and the CTA. Keep the tiers, but express them as three distances on the rail, not three boxes side by side.

### 9. Footer: the big wordmark books the page with the same gesture as the hero

**Where:** `index.html:1132–1199`, `src/styles/phase4.css:622–730`; `desktop-footer.jpg`, `mobile-footer.jpg`  
**What we see:** a large CTA headline, a pill button, mono meta, a link row, and a giant outlined `MERIDIAN` at the bottom. The hero already uses a giant solid `MERIDIAN`; the footer repeats the gesture at lower contrast. It reads as a required brand bookend rather than an ending to the forecast.  
**Why it reads generic:** “big closing CTA + oversized wordmark” is a template ending. It spends the final screen on the brand rather than on the decision the user has just made.  
**Direction:** end at D0 with an issued forecast or a booking slip: the chosen horizon, the forecast ID, the desk time, and one human confirmation. The closure should feel like leaving the model room with a document in hand, not seeing the logo again.

### 10. Page-wide: every section uses the same eyebrow, rule, mono label, and reveal grammar

**Where:** repeated across `index.html`; `src/styles/base.css:135`, `src/styles/content.css`, `src/styles/phase4.css`; all captures  
**What we see:** every section opens with a hairline, an accent rule, a `0X / LABEL` mono eyebrow; every sub-label is uppercase mono; headings sit left with a short lede at right; content enters with a fade/slide or a count-up. Small cyan labels and middle-dot metadata recur everywhere. The section order is the standard marketing funnel (problem → lanes → method → numbers → features → testimonials → pricing), only lightly weather-themed.  
**Why it reads generic:** the page is eight siblings in one template, not one continuous forecast. The repeated mono labels and hairline rhythm become chrome. There is no persistent time reading connecting the globe, route risk, copy, and sections.  
**Direction:** make the page one continuous forecast run. A single persistent D14→D0 day rail controls the globe, copy, risks, and section handoffs; remove the repeated `0X /` eyebrows and use day stamps only where they carry information. Vary the rhythm with dense instrument views and wide atmospheric pauses, not identical section headers.

## What must survive the upgrade

- The custom globe: its dot-matrix landmass, atmosphere, storm system, and restrained bloom are the strongest visual asset.
- The copy voice and specificity: `51 members`, `14 days`, `38,412 assets`, “Forecasts arrive as probabilities. Losses arrive as invoices.”
- The warm-bone-on-deep-ocean palette and the Bricolage Grotesque / IBM Plex Mono pairing.
- The existing section configuration in `src/lib/sections.ts` as the single source of order and labels.
- The accessibility shell: skip link, focus-visible outlines, reduced-motion branch, live-region announcements, keyboard controls.
- The Lenis + ScrollTrigger + Three.js foundation and the working preloader, even if their choreography is rebuilt in U1.

## Audit conclusion

Meridian does not need more effects. It needs a **single, legible idea of time** and for the forecast ensemble to become the page’s structural material. The upgrade should replace cards and carousels with forecast instruments, make the globe respond to one continuous day rail, and let the page move from uncertainty at D14 to a committed horizon at D0.

The direction for that rebuild is in `DIRECTION.md`.
