---
name: lenis-smooth-scroll
description: "Add Lenis smooth scrolling and wire it to GSAP ScrollTrigger: setup, the GSAP ticker loop, anchor links and offsets, stop/start for modals, nested scroll areas, resize/refresh, reduced-motion opt-out, and cleanup. Use when adding smooth scroll to a site, when ScrollTrigger lags or double-animates with Lenis, when anchors land under a fixed header, or when a modal freezes/unfreezes the page."
license: MIT
---

Written for this project. Assumes the current `lenis` package (v1.x; the old `@studio-freight/lenis` name is retired). Option names evolve — verify against the installed version.

# Lenis smooth scroll

## Setup

```bash
npm install lenis gsap
```

```js
import Lenis from "lenis";

const lenis = new Lenis({
  autoRaf: false,        // we drive the loop from GSAP's ticker
  duration: 1.1,
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 1.5,
  // lerp: 0.1,          // alternative to duration/easing; use one system
  anchors: true,        // handles <a href="#section"> clicks (verify offset support)
});
```

Lenis scrolls the real document by default, so ScrollTrigger keeps working without a proxy. Only use `scrollerProxy` for non-Lenis custom scrollers.

## GSAP ticker integration (the important part)

```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

lenis.on("scroll", ScrollTrigger.update); // ScrollTrigger must hear every Lenis frame

function raf(time) {
  lenis.raf(time * 1000); // GSAP gives seconds, Lenis wants ms
}
gsap.ticker.add(raf);
gsap.ticker.lagSmoothing(0); // Lenis already smooths; lag smoothing fights it
```

- One loop only. If `autoRaf` is left on while the GSAP ticker also calls `raf`, scroll runs twice per frame and feels rubbery.
- `ScrollTrigger.update` on `scroll` is mandatory; without it triggers fire at stale positions.
- If the project uses plain `requestAnimationFrame` instead of GSAP, use `new Lenis({ autoRaf: true })` and skip the ticker.

## CSS Lenis expects

Lenis adds classes to `<html>`; these rules are from its docs:

```css
html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
.lenis.lenis-stopped { overflow: hidden; }
.lenis.lenis-smooth iframe { pointer-events: none; }
```

Set `scroll-behavior: auto` (not `smooth`) on `html`; otherwise native smooth scrolling fights Lenis.

## Anchors and offsets

```js
// Simple: the anchors option intercepts same-document links
<a href="#work">Work</a>

// Fixed header: handle it yourself so the target clears the header
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    const id = link.getAttribute("href");
    const target = id && id !== "#" ? document.querySelector(id) : null;
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72, duration: 1.2 }); // -header height
  });
});
```

`lenis.scrollTo(target, { offset, duration, immediate, lock, force, onComplete })` accepts an element, selector, or pixel value. Use `immediate: true` for “jump without animation” (e.g. restoring a saved position).

## Stop and start

```js
const dialog = document.querySelector("dialog");

dialog.addEventListener("close", () => lenis.start());

function openDialog() {
  lenis.stop(); // blocks wheel/touch/keys on the page, keeps current position
  dialog.showModal();
}
```

- `lenis.stop()` is for modals, menus, and canvas-drag interactions; it does not destroy anything.
- Always pair stop/start; a stop left on makes the page feel broken.
- Nested scroll areas (a scrollable modal list, code block, map) need `data-lenis-prevent` so Lenis does not swallow their wheel events:

```html
<div class="modal-body" data-lenis-prevent>...</div>
```

- `prevent` can also be passed in options as a selector/function for elements that should scroll natively.

## Resize, refresh, and route changes

```js
window.addEventListener("resize", () => {
  lenis.resize();            // recompute dimensions
  ScrollTrigger.refresh();   // recompute trigger positions
});

document.fonts.ready.then(() => ScrollTrigger.refresh());
```

After dynamic content, pinned sections, or a route change, call `ScrollTrigger.refresh()`. Lenis recalculates its own dimensions on resize, but explicit `resize()` after programmatic layout changes is safer.

## Reduced motion (do not smooth)

```js
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let lenis = null;

function setupScroll() {
  if (reduced.matches) {
    lenis?.destroy();
    lenis = null;              // native scroll; no smoothing, no ticker
    gsap.ticker.remove(raf);
    return;
  }
  if (lenis) return;
  lenis = new Lenis({ autoRaf: false, anchors: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);
}
reduced.addEventListener("change", setupScroll);
setupScroll();
```

Smooth scrolling is a vestibular trigger; `prefers-reduced-motion` users should get instant native scroll. Camera motion and parallax need the same opt-out — see `threejs-scroll-camera` and `webgl-performance-a11y`.

## Cleanup

```js
function destroy() {
  gsap.ticker.remove(raf);
  lenis?.off("scroll", ScrollTrigger.update);
  lenis?.destroy();
  lenis = null;
  reduced.removeEventListener("change", setupScroll);
  window.removeEventListener("resize", onResize);
}
```

In React, create Lenis in an effect (or ref) and destroy in cleanup. Strict-mode remounts otherwise leave an orphan ticker that keeps calling a destroyed instance.

## Using ScrollSmoother instead

GSAP's ScrollSmoother is the built-in alternative and needs a specific `#smooth-wrapper > #smooth-content` DOM structure. Do not run Lenis and ScrollSmoother together; both transform/scroll the page and will fight.

## Common mistakes

- `new Lenis()` with default autoRaf plus `gsap.ticker.add(lenis.raf)` → double updates, jitter, and doubled speed.
- Forgetting `lenis.on("scroll", ScrollTrigger.update)` → pinned sections and scrubbed timelines lag one frame or freeze.
- Passing seconds to `lenis.raf` (GSAP gives seconds, Lenis expects ms) → scroll barely moves.
- Adding `ScrollTrigger.scrollerProxy` for Lenis → unnecessary with native Lenis scroll and a common source of broken pinning.
- Leaving `html { scroll-behavior: smooth; }` → native smoothing competes with Lenis.
- `lenis.stop()` for a modal and never calling `start()` → page appears frozen.
- Nested scrollable areas without `data-lenis-prevent` → wheel events scroll the page instead of the list.
- Smoothing for `prefers-reduced-motion: reduce` users → accessibility violation and nausea risk.
- Not refreshing ScrollTrigger after fonts, images, or layout changes → anchors and pins land at old positions.
- Creating a new Lenis on every render without destroying the old one → stacked tickers and leaked listeners.
- Importing from `@studio-freight/lenis` in new code → use `lenis`.

## See also

- `gsap-scrolltrigger-motion`, `threejs-scroll-camera`, `webgl-performance-a11y`.
