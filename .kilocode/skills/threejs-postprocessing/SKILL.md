---
name: threejs-postprocessing
description: "Add screen-space effects to a Three.js scene with EffectComposer or the pmndrs postprocessing library: bloom, chromatic aberration, film grain, vignette, depth of field, SSAO, outline, custom shader passes, correct pass order and resize, plus the relative GPU cost of each pass. Use when adding glow/grade/film look, when effects are too slow on mobile, when colors look washed out after adding a composer, or when choosing between three addons and the postprocessing library."
license: MIT
---

Source: https://github.com/cloudai-x/threejs-skills (MIT), trimmed and extended with a per-pass cost table. Targets three.js r186.

# Three.js Post-Processing

A composer renders the scene into an off-screen buffer, chains passes, and writes the final image. EffectComposer and its addon passes work with `WebGLRenderer`; `WebGPURenderer` uses `RenderPipeline` with TSL nodes instead.

## Quick start (three addons)

```js
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const composer = new EffectComposer(renderer); // takes the renderer's pixel ratio at construction
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.2, // strength
  0.4, // radius
  0.85, // luminance threshold: what glows
);
composer.addPass(bloom);
composer.addPass(new OutputPass()); // applies tone mapping + sRGB once, last

renderer.setAnimationLoop(() => {
  composer.render(); // not renderer.render()
});
```

Order matters: `RenderPass` → linear-space effects (bloom, DOF, SSAO, outline, grain, chromatic shift) → `SMAAPass` → `OutputPass` → `FXAAPass` only if used (FXAA needs sRGB input). Without FXAA, `OutputPass` is last. Without `OutputPass`, tone mapping and color conversion are skipped or applied unevenly, which is the usual "washed out after adding bloom" bug.

## Resize and MSAA

```js
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h); // resizes buffers and every pass, pixel ratio included
}
```

The composer's buffers are not multisampled; `antialias: true` does not reach them. For MSAA, construct with an explicit HDR buffer:

```js
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType, // needed for values above 1.0 (bloom, HDR)
    samples: 4,
  }),
);
composer.setSize(window.innerWidth, window.innerHeight);
```

Call `renderer.setPixelRatio()` before constructing the composer, or `composer.setPixelRatio()` after. Never resize a pass by hand; the composer owns it.

## The four requested looks

```js
import { FilmPass } from "three/addons/postprocessing/FilmPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";
import { VignetteShader } from "three/addons/shaders/VignetteShader.js";

// Film grain: (intensity, grayscale); animates from the composer's internal time
composer.addPass(new FilmPass(0.35, false));

// Vignette: darkens edges
const vignette = new ShaderPass(VignetteShader);
vignette.uniforms.offset.value = 1.0;
vignette.uniforms.darkness.value = 1.0;
composer.addPass(vignette);

// Chromatic aberration: RGBShiftShader offsets channels (not a true lens model)
const shift = new ShaderPass(RGBShiftShader);
shift.uniforms.amount.value = 0.0015; // in UV units; keep tiny
shift.uniforms.angle.value = 0;
composer.addPass(shift);

// Bloom: strength 0.6-1.5, threshold 0.7-0.9, radius 0.2-0.6 for a grade, not a toy
```

For a real lens-style aberration, use the pmndrs library's `ChromaticAberrationEffect`, which modulates the offset radially.

## Selective bloom

Bloom only layer-marked meshes: render a bloom-only composer off screen with everything else painted black, then mix its texture into a clean final composer. Two composers must both be resized.

```js
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);
mesh.layers.enable(BLOOM_LAYER); // enable, not set

const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const saved = new Map();

function darken(o) {
  if (o.isMesh && !bloomLayer.test(o.layers)) {
    saved.set(o, o.material);
    o.material = darkMaterial;
  }
}
function restore(o) {
  if (saved.has(o)) {
    o.material = saved.get(o);
    saved.delete(o);
  }
}

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
bloomComposer.addPass(bloom);

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(mixPass); // ShaderPass adding baseTexture + bloomTexture
finalComposer.addPass(new OutputPass());

function render() {
  const bg = scene.background;
  scene.background = null; // background is not a mesh; it would bloom and be added twice
  scene.traverse(darken);
  bloomComposer.render();
  scene.traverse(restore);
  scene.background = bg;
  finalComposer.render();
}
```

`mixPass` is the custom `ShaderPass` from the section below: `baseTexture` is filled from the previous pass automatically, and `bloomTexture` is set to `bloomComposer.renderTarget2.texture`. Resize `bloomComposer` alongside `finalComposer`.

## Depth of field, SSAO, outline

```js
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";

// DOF: focus is view-space depth in world units
const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: 0.025, maxblur: 0.01 });
composer.addPass(bokeh);

// SSAO darkens the previous image; a RenderPass must come first
const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssao.kernelRadius = 16;
ssao.minDistance = 0.005;
ssao.maxDistance = 0.1;
composer.addPass(ssao);

// Outline: only selected objects
const outline = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera,
);
outline.selectedObjects = [mesh];
outline.edgeStrength = 3;
composer.addPass(outline);
```

## Custom pass

`ShaderPass` feeds the previous result into `tDiffuse`. Keep custom effects before `OutputPass` unless they need sRGB input.

```js
const WaveShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      uv.x += sin(uv.y * 12.0 + uTime) * 0.01 * uAmount;
      gl_FragColor = texture2D(tDiffuse, uv);
    }`,
};

const wave = new ShaderPass(WaveShader);
composer.addPass(wave);
// in the loop: wave.uniforms.uTime.value = timer.getElapsed();
```

## Alternative: the `postprocessing` library (pmndrs)

```js
import { Vector2 } from "three";
import { EffectComposer, EffectPass, RenderPass, BloomEffect,
         ChromaticAberrationEffect, NoiseEffect, VignetteEffect, BlendFunction } from "postprocessing";

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera,
  new BloomEffect({ intensity: 1.2, luminanceThreshold: 0.8, mipmapBlur: true }),
  new ChromaticAberrationEffect({ offset: new Vector2(0.001, 0.001) }),
  new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true }),
  new VignetteEffect({ offset: 0.3, darkness: 0.5 }),
));
composer.render(); // in the loop
```

`EffectPass` merges its effects into one full-screen shader, which is usually cheaper than N separate `ShaderPass`es. Do not mix the two libraries in one chain: the pmndrs composer owns its passes and loop, so pick one API and one composer.

## Per-pass performance cost

These are relative GPU costs for a 1080p-class buffer. Measure on target hardware; costs scale with resolution and are fill-rate bound.

| Effect | Relative cost | Why | Cheaper option |
|---|---|---|---|
| RenderPass | 1× scene | Baseline scene render, shadows included | Lower `dpr`, fewer draw calls |
| Bloom (UnrealBloomPass / BloomEffect) | High (multiple mip blurs) | 5 blur levels + composite; the biggest single cost | Lower strength/radius, bloom at half resolution, smaller emissive areas |
| Depth of field (BokehPass) | High | CoC + many taps per pixel | Narrow focus range, lower resolution buffer |
| SSAO / GTAO | High | Depth + normal prepass, then sampling | Half-res AO, larger kernel only where needed |
| Outline | Medium | Extra render of selected objects | Keep `selectedObjects` small |
| TAA / temporal effects | High | Motion vectors, history, jitter | Skip on mobile |
| SMAA | Medium | Multiple edge passes | FXAA if edges tolerate it |
| FXAA | Low | One pass, no MSAA | Use on low-end instead of MSAA |
| Film grain (FilmPass / NoiseEffect) | Low | One hash + blend | Lower intensity does not reduce cost |
| Vignette | Low | One multiply by radial falloff | Bake into the CSS/frame instead |
| Chromatic / RGB shift | Low | Two extra texture reads | Disable on mobile |
| Film grain + vignette + shift together | Still low | Cheap passes dominate only when resolution is high | Combine into one custom pass |

Budget rule: one high-cost pass (bloom or DOF) plus cheap grading passes. Two high-cost passes at full DPR on a phone will miss 60 fps. Halve the composer resolution (`composer.setPixelRatio(1)`) before removing the effect.

## Common mistakes

- `composer.render(); renderer.render(scene, camera);` → only `composer.render()`; the second call clears the canvas and erases the composed image.
- Missing `OutputPass` at the end → tone mapping/color space skipped; add it before FXAA, never after it.
- `new SMAAPass(width, height)` or `new HalftonePass(width, height, params)` → argument-less `SMAAPass()`, `HalftonePass(params)`; sizes were removed in r175.
- `bloom.resolution.set(w, h)` → `composer.setSize(w, h)`; UnrealBloomPass reads its resolution only in the constructor and the composer resizes it.
- Passing a half-size resolution to UnrealBloomPass to save cost → `addPass` immediately resizes it; lower the composer's pixel ratio instead.
- `composer.setPixelRatio` before the renderer's ratio is set, or resizing passes manually → resize the renderer and composer only.
- Selective bloom with `mesh.layers.set(1)` → `layers.enable(1)`, and restore `scene.background` around the bloom render or it blooms and is added twice.
- FXAA before `OutputPass` → FXAA needs sRGB input; place it after. SMAA goes before.
- Using `antialias: true` and expecting the composer's buffers to be multisampled → pass an explicit render target with `samples: 4`.
- Mixing `EffectComposer` from three addons with the pmndrs `postprocessing` library in one chain → pick one.
- `new THREE.PostProcessing(renderer)` under WebGPU → `new THREE.RenderPipeline(renderer)` (renamed in r183).
- Leaving `renderer.info.autoReset` on when profiling passes → set it false and reset once per frame.

## See also

- `threejs-fundamentals` (renderer, color space, resize), `threejs-shaders-glsl` (custom pass shaders), `webgl-performance-a11y` (frame budget and mobile fallbacks).
