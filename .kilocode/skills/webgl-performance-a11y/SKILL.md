---
name: webgl-performance-a11y
description: "Keep WebGL/Three.js experiences at 60 fps and accessible: frame budget, DPR and pixel budget, draw-call and fill-rate limits, mobile quality tiers and fallbacks, reduced particle counts, prefers-reduced-motion handling, pause when hidden/offscreen, keyboard access for 3D, focus states, text contrast over canvas, and ARIA for decorative vs interactive scenes. Use when a scene drops frames on phones, when adding reduced-motion support, or before shipping a canvas-based site."
license: MIT
---

Written for this project. Accessibility guidance is informed by addyosmani/agent-skills `accessibility-engineering` (MIT, WCAG 2.2 AA) and performance guidance by cloudai-x/threejs-skills `threejs-performance` (MIT). Verify WCAG details against the current spec.

# WebGL performance and accessibility

## The frame budget

| Target | Budget per frame | Practical aim |
|---|---|---|
| 60 fps | 16.7 ms | ≤ 10–12 ms CPU+GPU, headroom for GC |
| 120 fps | 8.3 ms | ≤ 6 ms; only on capable desktops |
| 30 fps fallback | 33 ms | acceptable only as a degraded mode |

Split roughly: JS/CPU ≤ 4 ms, GPU ≤ 8 ms, compositing ≤ 2 ms. A single full-screen bloom pass on a phone can consume the whole GPU budget.

Measure before optimizing:

```js
let last = performance.now(), acc = 0, frames = 0, fps = 60;

renderer.setAnimationLoop((t) => {
  const dt = t - last;
  last = t;
  acc += dt; frames++;
  if (acc >= 1000) {
    fps = (frames * 1000) / acc;
    acc = 0; frames = 0;
    // lower quality if fps < 50 for two consecutive samples
  }
  renderer.render(scene, camera);
});

// Draw calls, triangles, GPU memory (after render)
console.log(renderer.info.render.calls, renderer.info.render.triangles, renderer.info.memory);
```

`renderer.info` does not include shader execution time; use a GPU timer query or Chrome's GPU view for that. Measure on the slowest target device, not the dev laptop.

## Pixel budget and DPR

```js
const dpr = Math.min(devicePixelRatio, isMobile ? 1.5 : 2);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
// Pixels shaded ≈ CSS area × dpr². DPR 3 = 9× the work of DPR 1.
```

- Cap DPR at 2 desktop, 1.5 mobile as a starting point; step down to 1 before removing content.
- For heavy scenes render at 0.75–1× and upscale; a slightly soft image beats 30 fps.
- Resize targets, composer, and passes together. A stale target keeps the old pixel count.

## Draw calls and fill rate

- Instance repeated geometry (`InstancedMesh`, drei `Instances`), merge static meshes that share a material, and use `LOD`/`Detailed`.
- Shadow maps render the scene again; disable `castShadow` on small props and tighten the shadow camera.
- Transparent and additive layers are fill-rate bound: reduce count and point size, not just vertex count.
- Full-screen passes (bloom, DOF, SSAO) are the biggest mobile cost. One high-cost pass maximum; halve the composer resolution before dropping the effect.
- Avoid `discard` and dynamic loops in fragment shaders; they hurt early-Z and tile-based GPUs.
- Use `renderer.info.render.calls` as a budget: roughly <100 draw calls for a site hero, <50 on mobile.

## Mobile quality tiers

Device hints are unreliable; frame time is the truth.

```js
const coarse = matchMedia("(pointer: coarse)").matches;
const lowMem = navigator.deviceMemory != null && navigator.deviceMemory <= 4;
const tier = coarse || lowMem ? "low" : "high"; // starting guess only

const quality = {
  high: { dpr: 2, particles: 1.0, post: true,  shadows: true },
  low:  { dpr: 1.5, particles: 0.35, post: false, shadows: false },
}[tier];
```

- Start low on mobile and step up only if frames stay under budget; starting high and thrashing down is visible.
- Reduced particle counts: desktop 50k–200k depending on shader, recent phone 5k–20k, low-end 1k–5k. Scale by fill rate, not count alone.
- Drop post-processing first, then pixel ratio, then particle count, then geometry detail; keep the composition and the hero idea intact.
- Provide a static fallback: a poster image with the same framing, shown when WebGL2 is unavailable, context is lost, or quality bottoms out.

```js
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch {
  showPoster(); // no WebGL2: do not leave a black rectangle
}

canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  renderer.setAnimationLoop(null);
  showPoster();
});
```

## Pause when hidden or offscreen

```js
document.addEventListener("visibilitychange", () => {
  if (document.hidden) renderer.setAnimationLoop(null);
  else renderer.setAnimationLoop(loop);
});

const io = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) renderer.setAnimationLoop(loop);
  else renderer.setAnimationLoop(null);
}, { rootMargin: "200px" });
io.observe(canvas);
```

A hidden tab or a scrolled-away hero should not burn battery. Pause shader time too (store elapsed and resume from it) so motion does not jump.

## prefers-reduced-motion

```js
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let motionOK = !reduced.matches;
let scrollTrigger = null; // assign where the GSAP timeline is created

function applyMotionPreference() {
  motionOK = !reduced.matches;
  scrollTrigger?.enable(motionOK);
  particles.visible = motionOK;
  uniforms.uAmplitude.value = motionOK ? 0.3 : 0;
  if (!motionOK) renderOnce(); // static composition, still rendered at full quality
}
reduced.addEventListener("change", applyMotionPreference);
```

- Respect it for camera travel, parallax, auto-rotation, particle drift, and large zoom/scale moves.
- Keep the image; remove the travel. Do not reduce the scene to a blank frame.
- If the only content is motion, provide a still frame that communicates the same idea.
- This is not a WCAG success criterion by itself, but it prevents vestibular symptoms; WCAG 2.2 does require pausing auto-updating motion (2.2.2) and limits flashing (2.3.1).
- Never flash more than three times per second; bloom/emissive pulses and strobes are a seizure risk, independent of reduced-motion.

## Keyboard access for 3D

A canvas is not focusable and has no semantics. Decide what it is:

```html
<!-- Decorative: hide it from assistive tech -->
<canvas id="bg" aria-hidden="true"></canvas>

<!-- Meaningful image: label it, and repeat the content in text -->
<canvas id="hero" role="img" aria-label="Sculptural glass form lit from the left"></canvas>
```

For an interactive viewer, expose DOM controls rather than trapping keys on the canvas:

```html
<div class="viewer" role="group" aria-label="3D product viewer">
  <canvas id="product" aria-hidden="true"></canvas>
  <button type="button" data-rotate="-15">Rotate left</button>
  <button type="button" data-rotate="15">Rotate right</button>
  <button type="button" data-reset>Reset view</button>
  <p class="sr-only" aria-live="polite" id="viewer-status">View: front</p>
</div>
```

- Real `<button>`s are keyboard-operable and focusable; wire them to camera/rotation state.
- If the canvas itself must take focus, give it `tabindex="0"`, a visible focus ring, a key map (arrows/±/Home), and an `aria-label` describing the keys. Avoid `role="application"` unless the full keyboard model is implemented.
- Announce state changes (rotation angle, zoom) through `aria-live` or a visible label; a silent canvas is unusable without sight.
- Never rely on drag, hover, or the custom cursor as the only way to interact.

## Focus and contrast

```css
.viewer:focus-within { outline: 2px solid var(--ring); outline-offset: 4px; }
button:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
```

- Never remove focus outlines. If you restyle them, keep ≥3:1 contrast against adjacent colors and at least 2 px thickness (WCAG 2.2 focus appearance).
- Text over a live canvas needs a scrim or a reserved solid area:

```css
.overlay-copy {
  background: rgb(0 0 0 / 0.62);
  color: #fff;
  padding: 16px;
  border-radius: var(--radius, 8px);
}
```

- Test against the brightest and darkest frames, not a static screenshot. Body text needs 4.5:1, large text and UI edges 3:1.
- A gradient scrim may pass at one end and fail at the other; measure both.
- Provide a `forced-colors` fallback: borders and buttons still visible when the OS overrides colors.

## Common mistakes

- Using `navigator.deviceMemory`/`hardwareConcurrency` as a guarantee → treat as a hint, adapt from measured frame time.
- Lowering DPR but keeping full-screen bloom and 100k additive particles → still misses budget.
- Removing `castShadow` from one prop while the shadow camera covers the whole world → no saving.
- Leaving the render loop running when the tab is hidden or the canvas is offscreen → battery drain and thermal throttling.
- `prefers-reduced-motion` checked once at load, with no `change` listener → ignores users who toggle it.
- Treating reduced motion as "shorter animation" while the camera still travels 20 units.
- Flashing/strobing emissive or bloom effects >3 Hz.
- Interactive canvas with no DOM controls, no keyboard path, and no state announcement.
- `aria-hidden="true"` on the only way to access content.
- Removing focus rings because the custom cursor "handles" hover.
- Text placed directly on a busy canvas with no scrim; contrast varies frame to frame.
- Omitting a no-WebGL poster, leaving a blank area and an inaccessible experience.
- Profiling with `console.log` every frame, which itself costs frame time.

## See also

- `threejs-fundamentals` (DPR, disposal), `threejs-particles-points` (counts and overdraw), `threejs-postprocessing` (pass costs), `threejs-scroll-camera` (reduced-motion camera), `lenis-smooth-scroll` (motion opt-out), `awwwards-design-principles` (focus/contrast discipline).
