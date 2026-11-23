---
name: gsap-scrolltrigger-motion
description: "Build scroll-driven and cinematic web motion with GSAP 3: timelines, eases and CustomEase, ScrollTrigger pin/scrub/toggleActions, horizontal scroll via containerAnimation, SplitText masked reveals, ScrollTrigger.batch, matchMedia and prefers-reduced-motion, and cleanup in React, Vue, or vanilla JS. Use when adding scroll animation, pinned sections, parallax, staggered text reveals, or when scroll animations break after resize/unmount."
license: MIT
---

Source: merged and trimmed from the official GSAP skills — https://github.com/greensock/gsap-skills (`gsap-core`, `gsap-scrolltrigger`, `gsap-plugins`; MIT).

# GSAP + ScrollTrigger Motion

## Install and register

```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase); // once, before any use
```

All GSAP plugins are free now, including SplitText and MorphSVG. Install from the public `gsap` package only; do not add a private registry or auth token.

## Core tweens

```js
gsap.to(".box", { x: 120, rotation: 360, duration: 1 });
gsap.from(".card", { autoAlpha: 0, y: 24, stagger: 0.08 });
gsap.fromTo(".hero", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" });
gsap.set(".panel", { autoAlpha: 0 });
```

- Use camelCase CSS names and transform aliases (`x`, `y`, `scale`, `rotation`, `rotationX`), not the raw `transform` string.
- `autoAlpha` sets `visibility: hidden` at 0, so invisible elements stop receiving clicks.
- Relative values (`x: "+=20"`, `rotation: "-=30"`), directional rotation (`"360_cw"`, `"-170_short"`), and function values `(i) => i * 50` are supported.
- `stagger` takes a number or `{ amount, from: "center" | "random" | "edges" }`.
- `overwrite: "auto"` kills overlapping properties on the same targets; use it when a hover tween fights an entrance tween.
- Multiple `from()` tweens on the same property: set `immediateRender: false` on the later one, or the first end state is overwritten.

## Easing

Built-ins: `power1-4`, `back`, `circ`, `expo`, `elastic`, `bounce`, `sine`, each `.in/.out/.inOut`; default is `power1.out`. Use `ease: "none"` whenever progress must map 1:1 to scroll.

```js
CustomEase.create("out-expo", "0.16, 1, 0.3, 1"); // cubic-bezier shorthand
CustomEase.create("hop", "M0,0 C0.05,0.44 0.17,0.44 0.33,0 0.41,1 0.67,1 1,0 1,0"); // SVG path
gsap.to(".el", { x: 100, ease: "out-expo", duration: 1.2 });
```

## Timelines

```js
const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } });
tl.addLabel("start")
  .from(".title", { yPercent: 100 })
  .from(".copy", { autoAlpha: 0, y: 16 }, "<0.15") // 0.15s after previous start
  .to(".rule", { scaleX: 1, transformOrigin: "left center" }, "<")
  .to(".cta", { autoAlpha: 1 }, "+=0.2");
```

Position parameter: absolute seconds, `"<"` (previous start), `"<0.2"` (offset), `"+=0.5"`, or a label. A timeline in a ScrollTrigger can be scrubbed and reversed; chained `delay`s cannot.

## ScrollTrigger basics

```js
gsap.to(".box", {
  x: 500,
  scrollTrigger: {
    trigger: ".box",
    start: "top center", // trigger position, viewport position
    end: "bottom center",
    scrub: 0.6, // number = seconds of catch-up; true = direct
    // toggleActions: "play reverse play reverse" — use this instead of scrub, not both
    markers: true, // dev only
  },
});
```

`start`/`end` accept `"top top"`, `"bottom 80%"`, pixels, `"+=100%"`, `"max"`, or a function. Wrap in `clamp()` (`"clamp(top bottom)"`) to stay in page bounds. `scrub` links progress to scroll; `toggleActions` fires four discrete actions (enter, leave, enterBack, leaveBack). `once: true` kills after the first pass.

## Pinning

```js
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".section",
    start: "top top",
    end: "+=1200",
    pin: true,
    scrub: 1,
    anticipatePin: 1,
  },
});
tl.from(".panel-a", { yPercent: 100 }).to(".panel-b", { yPercent: -100 });
```

- Pin the section, animate its children. Do not animate the pinned element's own transform.
- `pinSpacing` defaults true and adds a spacer; disable only if layout is handled elsewhere.
- Put ScrollTrigger on the timeline or a top-level tween, never on a child `.to()`.

## Horizontal scroll (containerAnimation)

```js
const track = document.querySelector(".track");
const distance = () => Math.max(0, track.scrollWidth - innerWidth);

const scrollTween = gsap.to(track, {
  x: () => -distance(), // exact distance in pixels
  ease: "none", // required: 1:1 scroll mapping
  scrollTrigger: {
    trigger: ".horizontal-panel",
    pin: true,
    start: "top top",
    end: () => `+=${distance()}`, // one pixel scrolled per pixel moved
    scrub: 1,
    invalidateOnRefresh: true,
  },
});

gsap.to(".nested", {
  y: 80,
  scrollTrigger: {
    containerAnimation: scrollTween,
    trigger: ".nested",
    start: "left center", // horizontal positions: left/right/center
    toggleActions: "play none none reset",
  },
});
```

Caveats: `ease: "none"` is mandatory; pinning and snapping are unavailable on `containerAnimation` triggers; animate an inner element, not the trigger itself, or offset start/end.

## Batched reveals

```js
ScrollTrigger.batch(".card", {
  start: "top 85%",
  once: true,
  interval: 0.1,
  batchMax: 4,
  onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, stagger: 0.08, overwrite: true }),
});
```

Batched callbacks receive `(elements, triggers)`, unlike normal callbacks which receive the instance. Good replacement for an IntersectionObserver reveal.

## SplitText masked reveal

```js
const split = SplitText.create(".heading", {
  type: "lines",
  mask: "lines", // wraps each line in an overflow:clip element
  autoSplit: true, // re-split after fonts load / width changes
  onSplit(self) {
    // returned tween is auto-reverted and time-synced on re-split
    return gsap.from(self.lines, {
      yPercent: 110,
      duration: 1.1,
      stagger: 0.08,
      ease: "power4.out",
    });
  },
});
```

- Only split what you animate (`"words"` instead of `"chars,words,lines"`); splitting chars alone needs `smartWrap: true`.
- `aria: "auto"` (default) keeps the text readable to screen readers by labelling the split element; use `"none"` only when you provide a screen-reader duplicate.
- Avoid `text-wrap: balance` and apply `font-kerning: none` if character splitting shifts kerning. SplitText does not support SVG `<text>`.
- Call `split.revert()` on unmount when not using `autoSplit`/`gsap.context`.

## Responsive and reduced motion

```js
const mm = gsap.matchMedia();
mm.add(
  { desktop: "(min-width: 800px)", reduce: "(prefers-reduced-motion: reduce)" },
  (ctx) => {
    const { desktop, reduce } = ctx.conditions;
    if (reduce) {
      gsap.set(".heading", { clearProps: "all" }); // static, readable
      return;
    }
    gsap.to(".panel", { xPercent: desktop ? -60 : -20, scrollTrigger: { /* ... */ } });
  },
);
// teardown: mm.revert()
```

`matchMedia` reverts its ScrollTriggers and tweens when the query stops matching. Do not nest `gsap.context()` inside it — matchMedia already owns a context.

## Cleanup

```js
// React: @gsap/react
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP, ScrollTrigger);

useGSAP(() => {
  const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, /* ... */ } });
  return () => tl.scrollTrigger?.kill(); // optional; the context reverts too
}, { scope: root });
```

- Vanilla/framework: wrap setup in `gsap.context(() => { ... }, root)` and call `ctx.revert()` in cleanup. `useGSAP` does this for you.
- Kill orphaned triggers on route changes: `ScrollTrigger.getAll().forEach((t) => t.kill())`, or keep ids and `ScrollTrigger.getById(id)?.kill()`.
- Call `ScrollTrigger.refresh()` after fonts, images, or dynamic content change trigger positions. Resize refreshes automatically (debounced ~200 ms); `refreshPriority` orders async-created triggers top to bottom.

## Performance

- Animate transforms and opacity; avoid `width`, `height`, `top`, `left`, `filter`, and `box-shadow`.
- Add `will-change: transform` only on the few elements that animate continuously, and remove it after.
- Batch reads/writes; avoid layout reads (getBoundingClientRect) inside `onUpdate`.
- One ScrollTrigger driving one timeline beats many triggers with repeated work. Prefer `scrub` over per-frame JS.
- `gsap.ticker.lagSmoothing(0)` only when syncing an external RAF loop (e.g. Lenis); otherwise leave defaults.

## Common mistakes

- `ScrollTrigger` on a child tween inside a timeline → put it on the timeline or a top-level tween.
- Using `scrub` and `toggleActions` on the same trigger → pick one; scrub wins.
- `ease` other than `"none"` on the horizontal animation → scroll position and x position drift apart.
- Creating ScrollTriggers out of page order without `refreshPriority` → pin spacing and start/end recalculate wrong.
- Leaving `markers: true` in production.
- Forgetting `ScrollTrigger.refresh()` after async content/images/fonts load → triggers fire at the old positions.
- Not killing triggers on unmount/route change → they run on detached elements and leak.
- Stacking `from()` tweens on the same property without `immediateRender: false` → the later tween starts from the wrong state.
- Animating `left`/`top`/`width` instead of `x`/`y`/`scale` → layout thrash each tick.
- Splitting text before fonts load → wrong line breaks; use `autoSplit` + `onSplit` or `document.fonts.ready`.
- Nesting `gsap.context()` inside `gsap.matchMedia()` → double cleanup; use `mm.revert()`.

## See also

- `lenis-smooth-scroll` for Lenis + GSAP ticker integration, `threejs-scroll-camera` for camera states driven by ScrollTrigger.
