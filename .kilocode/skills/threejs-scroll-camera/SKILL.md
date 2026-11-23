---
name: threejs-scroll-camera
description: "Sync a Three.js camera to page scroll with GSAP ScrollTrigger (and Lenis when present): named camera states, scrubbed timelines, damping, fov changes, and one fixed canvas shared across sections. Use when a site needs a cinematic camera that travels between sections, when multiple canvases waste GPU, or when camera motion jitters, desyncs, or breaks after resize."
license: MIT
---

Written for this project. Targets three.js r186 + GSAP 3.13 (ScrollTrigger). Lenis details live in `lenis-smooth-scroll`.

# Scroll-driven camera

## Setup

```js
import * as THREE from "three";

const canvas = document.querySelector("#webgl");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);

const timer = new THREE.Timer();
timer.connect(document);
```

## Architecture: one canvas, many sections

```html
<canvas id="webgl" aria-hidden="true"></canvas>
<main id="sections">
  <section class="hero">...</section>
  <section class="work">...</section>
  <section class="detail">...</section>
</main>
```

```css
#webgl {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none; /* page owns the scroll and clicks */
  display: block;
}
#sections { position: relative; z-index: 1; }
```

The canvas is fixed and the DOM scrolls over it. One renderer, one scene, one camera for the whole page — never one canvas per section, which multiplies contexts, draw calls, and memory.

## Named camera states

```js
const states = [
  { name: "hero",   position: [0, 6, 14],  target: [0, 0, 0],    fov: 45 },
  { name: "work",   position: [-6, 1, 8],  target: [-2, 0, 0],   fov: 55 },
  { name: "detail", position: [2, 0.4, 4], target: [0, 0.4, 0],  fov: 32 },
  { name: "outro",  position: [0, 12, 10], target: [0, 1, 0],    fov: 60 },
];

// Plain-object proxy: GSAP tweens numbers, the loop copies them into the camera.
const cam = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, fov: 45 };

function applyState(state) {
  gsap.set(cam, {
    px: state.position[0], py: state.position[1], pz: state.position[2],
    tx: state.target[0],   ty: state.target[1],   tz: state.target[2],
    fov: state.fov,
  });
}
```

Keep the states as data. A design change becomes editing numbers, not hunting camera code.

## Scrubbed timeline

```js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

const tl = gsap.timeline({
  defaults: { duration: 1, ease: "power2.inOut" },
  scrollTrigger: {
    trigger: "#sections",
    start: "top top",
    end: "bottom bottom",
    scrub: 0.8,              // seconds of smoothing; true = instant, 1 = weighted
    invalidateOnRefresh: true,
    // markers: true,        // dev only
  },
});

applyState(states[0]);

states.slice(1).forEach((state, i) => {
  tl.to(cam, {
    px: state.position[0], py: state.position[1], pz: state.position[2],
    tx: state.target[0],   ty: state.target[1],   tz: state.target[2],
    fov: state.fov,
  }, `state-${i + 1}`); // labels are optional; sequence is enough
});
```

- Put ScrollTrigger on the timeline, never on a child tween.
- `scrub: 0.8` is the requested "scrub smoothing": the camera catches up over ~0.8 s instead of snapping.
- `invalidateOnRefresh: true` re-reads `start`/`end` on resize; call `ScrollTrigger.refresh()` after fonts/images change layout.
- If sections are pinned, pin the DOM section, not the camera.

Per-frame copy:

```js
const target = new THREE.Vector3();

function render() {
  camera.position.set(cam.px, cam.py, cam.pz);
  target.set(cam.tx, cam.ty, cam.tz);
  camera.lookAt(target);

  if (Math.abs(camera.fov - cam.fov) > 0.001) {
    camera.fov = cam.fov;
    camera.updateProjectionMatrix(); // required after any fov change
  }
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(render);
```

`camera.lookAt()` writes the quaternion every frame. Do not also drive `camera.rotation` or OrbitControls at the same time; one owner for the transform.

## Progress-lerp alternative

When states are not a simple sequence, or when scroll must not be the only driver (pointer parallax, inertia), keep a scalar and damp it:

```js
let scrollProgress = 0;
let smoothProgress = 0;

ScrollTrigger.create({
  trigger: "#sections",
  start: "top top",
  end: "bottom bottom",
  onUpdate: (self) => { scrollProgress = self.progress; },
});

// in the frame loop
const dt = timer.getDelta();
smoothProgress = THREE.MathUtils.damp(smoothProgress, scrollProgress, 4, dt);

const i = Math.min(states.length - 2, Math.floor(smoothProgress * (states.length - 1) + 1e-6));
const local = smoothProgress * (states.length - 1) - i;
const a = states[i];
const b = states[i + 1];

camera.position.set(
  THREE.MathUtils.lerp(a.position[0], b.position[0], local),
  THREE.MathUtils.lerp(a.position[1], b.position[1], local),
  THREE.MathUtils.lerp(a.position[2], b.position[2], local),
);
target.set(
  THREE.MathUtils.lerp(a.target[0], b.target[0], local),
  THREE.MathUtils.lerp(a.target[1], b.target[1], local),
  THREE.MathUtils.lerp(a.target[2], b.target[2], local),
);
camera.lookAt(target);
```

`MathUtils.damp` is frame-rate independent (it takes `dt`). A raw `lerp(a, b, 0.1)` each frame is not; motion feels different at 60 vs 120 Hz. Use the progress-lerp path when you need pointer offset layered on top:

```js
camera.position.x += pointer.x * 0.4; // after the scroll transform, before lookAt
```

## Lenis and ScrollTrigger

With Lenis on native scroll, ScrollTrigger only needs the update hook:

```js
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

Do not call `lenis.stop()` around the canvas; the DOM owns scrolling. Stop Lenis only for modals/menus. Details in `lenis-smooth-scroll`.

## Resize and DPR

```js
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false); // false: do not set CSS size; CSS handles the fixed canvas
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ScrollTrigger.refresh();
}
window.addEventListener("resize", resize);
```

`setSize(w, h, false)` avoids inline CSS fighting the `position: fixed; width: 100vw` rules. Resize the composer too if one exists.

## Reduced motion and fallback

```js
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function applyMotionPreference() {
  tl.scrollTrigger?.enable(!reduced.matches);
  if (reduced.matches) applyState(states[0]); // static hero shot, no travel
}
reduced.addEventListener("change", applyMotionPreference);
applyMotionPreference();
```

For a no-WebGL fallback, hide the canvas and show a static poster `<img>` with the same framing; do not leave an empty black rectangle. See `webgl-performance-a11y`.

## Cleanup

```js
function destroy() {
  renderer.setAnimationLoop(null);
  tl.scrollTrigger?.kill();
  tl.kill();
  reduced.removeEventListener("change", applyMotionPreference);
  window.removeEventListener("resize", resize);
  scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  renderer.dispose();
  renderer.forceContextLoss();
}
```

In React, run this from the effect cleanup; keep the ScrollTrigger and timeline in refs so strict-mode remounts create exactly one each.

## Common mistakes

- One canvas per section → several WebGL contexts, duplicated scenes, and mobile context loss. Use one fixed canvas.
- Putting the canvas above the content without `pointer-events: none` → links and scroll gestures stop working.
- ScrollTrigger on a child tween of the timeline → it never scrubs correctly; attach it to the timeline.
- Using `scrub` and `toggleActions` on the same trigger → pick one.
- Forgetting `camera.updateProjectionMatrix()` after fov changes → the fov value changes but the projection does not.
- Calling `camera.lookAt()` in both `onUpdate` and the render loop → the later call wins and the motion stutters.
- `lerp(current, target, 0.1)` per frame instead of `MathUtils.damp` → speed depends on refresh rate.
- Animating the pinned section's own transform while its children animate → layout jitter; pin the section, animate children.
- Not calling `ScrollTrigger.refresh()` after fonts/images or after Lenis changes layout → camera states trigger at stale offsets.
- Leaving `markers: true` in production.
- Resizing the renderer with `setSize(w, h)` and inline CSS sizing on a fixed canvas → double-scaling and blurry output.

## See also

- `lenis-smooth-scroll`, `gsap-scrolltrigger-motion`, `threejs-fundamentals`, `threejs-postprocessing`.
