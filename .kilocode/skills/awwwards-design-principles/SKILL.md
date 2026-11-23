---
name: awwwards-design-principles
description: "Art-direct an award-level marketing site: editorial typography, asymmetric grids, palette discipline, one motion hierarchy, custom cursor, magnetic buttons, masked reveals, and microinteractions that answer input instead of decorating. Use when a page must feel premium/award-worthy, when a design looks generic or evenly weighted, when adding a hero moment, or when deciding which interactions deserve motion."
license: MIT
---

Adapted from ideas in Ga14ctic/awwwards-skill (MIT), Leonxlnx/taste-skill (MIT), pbakaus/impeccable (Apache-2.0), and anthropics/skills frontend-design (Apache-2.0). Text and code written for this project; no source files copied.

# Awwwards-level design principles

Award sites are not "more effects". They have one clear idea from the subject, a composition with deliberate imbalance, typography with a voice, a restrained palette, and one or two moments of motion that feel authored. Everything else stays quiet.

## Editorial typography

```css
:root {
  --step-1: clamp(0.875rem, 0.83rem + 0.2vw, 1rem);
  --step-2: clamp(1.125rem, 1rem + 0.5vw, 1.5rem);
  --step-4: clamp(2.5rem, 1.6rem + 4vw, 5rem);
  --display: clamp(4rem, 10vw, 12rem);
}

.display {
  font-size: var(--display);
  line-height: 0.88;
  letter-spacing: -0.035em;
  text-wrap: balance;
}

.body {
  max-width: 62ch;         /* under ~80 characters incl. spaces */
  line-height: 1.55;
  hanging-punctuation: first;
}
```

- One or two families. If two, contrast them clearly (grotesk + serif, not two similar sans).
- Use scale and weight for hierarchy before color. A page with six font sizes and no size jump reads flat.
- Tight leading on display, roomy leading on body. Headlines can overlap the grid; body copy should not.
- Editorial details: hanging punctuation, old-style figures, real small caps, optical margin alignment, a consistent baseline.
- Set `text-wrap: pretty` on paragraphs and `balance` on headings; test real copy, not lorem.
- If type is the hero, treat it as image: clipping, masks, oversized words, outlined counters. If it is not, keep it invisible.

## Asymmetric grid

```css
.page {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: clamp(1rem, 2vw, 2rem);
  padding-inline: clamp(1rem, 5vw, 6rem);
}

.hero-copy { grid-column: 1 / 7; align-self: end; }
.hero-media { grid-column: 7 / 12; margin-top: 18vh; }  /* deliberately late */
.feature   { grid-column: 2 / 11; }                      /* inset from both edges */
.aside     { grid-column: 9 / 13; align-self: center; }
```

- Imbalance should be explainable: the image is late because the headline leads; the feature is inset because it is supporting evidence.
- Use one strong vertical break and varied column spans, not evenly sized cards.
- On mobile collapse to a single column and keep the reading order; asymmetry must not become a maze.
- Whitespace is a material. A section with one huge number and lots of air beats a dense card grid.

## Palette discipline

```css
:root {
  --ink: #14110f;        /* type and primary surface */
  --paper: #f2efe9;      /* ground */
  --accent: #c2410c;     /* one accent, used sparingly */
  --muted: #6f6862;      /* secondary text */
  --line: rgb(20 17 15 / 0.15);
}
```

- Three neutrals plus one accent. The accent gets ≤10% of the pixels and carries meaning (action, state, highlight).
- Derive the palette from the subject (material, light, era), not from the current trend. Avoid the default cream + terracotta + serif combination unless the brief asks for it.
- Check text contrast: 4.5:1 for body, 3:1 for large text and UI edges. An accent is not a body color.
- Build elevation with value and texture, not drop shadows on everything.

## One motion hierarchy

| Level | Use | Duration | Easing |
|---|---|---|---|
| 0 | Static, no motion | — | — |
| 1 | Hover/press feedback | 120–220 ms | `ease-out` or `cubic-bezier(.2,.8,.2,1)` |
| 2 | Reveals, staggers, page transitions | 400–700 ms | `cubic-bezier(.16,1,.3,1)` |
| 3 | The one hero moment (load, camera move, mask reveal) | 900–1600 ms | custom, authored |

- Pick one Level 3 moment per page. Everything else is Level 1 or 2.
- If every section fades up on scroll, the page has no hierarchy; make the hero land once and let later sections arrive faster.
- Motion must answer an action (open, confirm, focus) or reveal content; ambient motion that never resolves is noise.
- Animate `transform` and `opacity`. Layout properties cost frames.
- Respect `prefers-reduced-motion`: keep the content, drop the travel.

## Custom cursor (pointer-fine only)

```css
.cursor { display: none; }

@media (pointer: fine) {
  .cursor {
    position: fixed;
    top: 0; left: 0;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: white;
    mix-blend-mode: difference; /* reads on light and dark */
    pointer-events: none;
    z-index: 9999;
    translate: -50% -50%;
    display: block;
  }
}
```

```js
if (matchMedia("(pointer: fine)").matches) {
  const dot = document.querySelector(".cursor");
  let x = 0, y = 0, tx = 0, ty = 0;

  addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; });

  (function tick() {
    x += (tx - x) * 0.18;   // weighty follow; use GSAP quickTo for springs
    y += (ty - y) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    requestAnimationFrame(tick);
  })();
}
```

- Never hide the native cursor on touch or for keyboard users: gate on `(pointer: fine)` and keep focus rings.
- Grow the cursor over links (`scale(3)` with a blend mode) instead of adding a separate hover effect.
- Keep it decorative: no click target depends on the custom cursor.

## Magnetic buttons

```js
const button = document.querySelector(".magnetic");

button.addEventListener("pointermove", (e) => {
  const r = button.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  button.style.transform = `translate(${dx * 0.22}px, ${dy * 0.22}px)`;
});

button.addEventListener("pointerleave", () => {
  button.style.transform = "translate(0, 0)"; // transition handles the return
});
```

```css
.magnetic { transition: transform 220ms cubic-bezier(.2,.8,.2,1); will-change: transform; }
```

With GSAP, use `gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" })` instead of writing transforms per event. Cap the offset; over-magnetism feels like a bug.

## Masked reveals and microinteractions

```css
.reveal-mask { overflow: clip; }           /* parent clips the moving child */
.reveal-child { display: block; transform: translateY(110%); }
.is-in .reveal-child { transform: translateY(0); transition: transform 700ms cubic-bezier(.16,1,.3,1); }

.link {
  background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
  transition: background-size 300ms cubic-bezier(.16,1,.3,1);
}
.link:hover, .link:focus-visible { background-size: 100% 1px; }
```

- Masked text reveal: clip the container, move the inner line. The same pattern works with GSAP SplitText `mask: "lines"`. Add `.is-in` with an `IntersectionObserver` (or a ScrollTrigger `onEnter`) and remove it on leave only if the reveal should replay.
- Underline draw on links, a 1.02 image scale inside a fixed frame, a color sweep on buttons — pick two, not ten.
- Hover states must also exist for `:focus-visible`; keyboard users get the same affordance.
- Use `clip-path` for image reveals; avoid animating `width`/`height`.
- Cursor growth, magnetic pull, and mask reveals share one easing family so the page feels authored.

## Section rhythm

- Alternate dense and sparse sections: a full-bleed image, then a narrow text block, then a wide grid.
- Keep one consistent margin language (a 12-column grid and 2–3 gap values) so asymmetry reads as intent, not error.
- Give the page a memorable closing moment (a large word, a contact reveal, a final image), not a generic footer of columns.
- Remove one accessory before shipping: one fewer badge, one fewer gradient, one fewer hover.

## Common mistakes

- Every section fades/slides up on scroll → no hierarchy; save the entrance for the hero.
- Five accents and gradient washes → the page reads as a template with no point of view.
- Asymmetric grid with random spans that collapse into an unpredictable mobile order.
- Custom cursor on touch devices, or hiding the native cursor for keyboard users.
- Magnetic buttons with unbounded offset or no return easing → feels broken, not premium.
- Animating `width`, `height`, `top`, `left`, or `box-shadow` → jank on mid-range phones.
- Display type at 40ch line length, or body copy at 120ch → unreadable; set max-width and test real copy.
- Low-contrast accent-colored body text to look "designed" → fails WCAG and is hard to read outdoors.
- Hover-only interactions with no focus-visible equivalent.
- Copy written last as filler → the voice is part of the design; write it with the layout.
- Shipping all effects without a `prefers-reduced-motion` path.

## See also

- `frontend-design` (design direction and critique), `gsap-scrolltrigger-motion` (masked reveals), `webgl-performance-a11y` (motion and contrast guardrails).
