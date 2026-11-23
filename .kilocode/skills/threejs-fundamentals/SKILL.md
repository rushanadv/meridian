---
name: threejs-fundamentals
description: "Set up and maintain a Three.js scene on the current API (r186): WebGLRenderer with capped DPR, perspective/orthographic cameras, render loop with Timer, resize handling, color management and tone mapping, object transforms, disposal of geometries/materials/textures, and draw-call basics. Use when creating a scene from scratch, configuring the renderer or camera, fixing resize/DPR bugs, adding fog/background, or cleaning up a scene on unmount."
license: MIT
---

Source: https://github.com/cloudai-x/threejs-skills (MIT), trimmed for this project. Targets three.js r186; verify any API not shown here against the installed version.

# Three.js Fundamentals

## Quick start

```js
import * as THREE from "three";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap: fill rate, not sharpness
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// renderer.outputColorSpace is SRGBColorSpace by default; leave it alone
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);
scene.fog = new THREE.Fog(0x111318, 8, 40); // near, far (FogExp2 for density)

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);
camera.position.set(0, 1.5, 6);

const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.35 }),
);
scene.add(cube);

const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(3, 4, 5); // direction is from position toward target (origin by default)
key.castShadow = true;
scene.add(key, new THREE.AmbientLight(0xffffff, 0.4));

const timer = new THREE.Timer();
timer.connect(document); // pauses delta while the tab is hidden

renderer.setAnimationLoop(() => {
  timer.update();
  cube.rotation.y += timer.getDelta(); // seconds, frame-rate independent
  renderer.render(scene, camera);
});
```

`Clock` is deprecated in r183 and warns on construction; use `Timer` and call `update()` once per frame before reading. Prefer `renderer.setAnimationLoop(fn)` over a manual `requestAnimationFrame` loop: WebXR frames and WebGPU init depend on it.

## Resize and DPR

```js
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix(); // required after fov/aspect/near/far changes
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);
```

- Cap DPR at 2 (1.5 on mobile is often enough). At DPR 3 a full-screen scene shades 9× the pixels of CSS size.
- `setSize(w, h)` takes CSS pixels and multiplies by the pixel ratio internally. Do not pass `w * dpr`.
- Recompute `OrthographicCamera.left/right/top/bottom` from the new aspect, then call `updateProjectionMatrix()`.
- If a composer or render target exists, resize it too; see `threejs-postprocessing`.

## Color and tone mapping

```js
THREE.ColorManagement.enabled = true; // default; keeps hex/CSS colors sRGB
scene.background = new THREE.Color("#0b0d12");
renderer.toneMapping = THREE.ACESFilmicToneMapping; // AgX, Neutral, NoToneMapping
renderer.toneMappingExposure = 1.1;

const tex = new THREE.TextureLoader().load("albedo.jpg");
tex.colorSpace = THREE.SRGBColorSpace; // color maps only; normal/roughness stay NoColorSpace
```

- Hex numbers and CSS strings are interpreted as sRGB; `color.setRGB(r, g, b)` writes linear values. Mixing them without thinking shifts hues and light intensity.
- Tone mapping applies to rendered output, not to CSS. If the page design assumes flat sRGB colors, `NoToneMapping` may match better.
- Text/UI overlays on a transparent canvas need `alpha: true` plus `renderer.setClearColor(0x000000, 0)`.

## Cameras

```js
// Orthographic: frustum height in world units, width from aspect
const aspect = window.innerWidth / window.innerHeight;
const frustumHeight = 10;
const ortho = new THREE.OrthographicCamera(
  (-frustumHeight * aspect) / 2,
  (frustumHeight * aspect) / 2,
  frustumHeight / 2,
  -frustumHeight / 2,
  0.1,
  100,
);
```

Use one camera per view. Call `updateMatrixWorld()` for cameras that are not children of the scene and therefore are not auto-updated. Avoid calling `camera.lookAt()` every frame if another system (controls, ScrollTrigger) also writes the quaternion.

## Objects and transforms

```js
const group = new THREE.Group();
group.position.set(1, 0, 0);
group.rotation.y = Math.PI / 4;
group.scale.setScalar(1.5);
scene.add(group);

const mesh = new THREE.Mesh(geometry, material);
group.add(mesh); // local transform preserved
group.attach(mesh); // keeps mesh's world transform

mesh.castShadow = true;
mesh.receiveShadow = true;
mesh.frustumCulled = true; // default; disable only for custom-displaced geometry

obj.traverse((o) => {
  if (!o.isMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  for (const m of mats) m.envMapIntensity = 1;
});
```

Coordinate system: right-handed, +Y up, +Z toward the viewer; a camera at the origin unrotated looks down −Z. `Object3D.layers.enable(n)` adds a layer; `set(n)` replaces the mask and removes layer 0 (the default camera/lights layer).

## Cleanup and disposal

```js
function disposeObject(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      for (const value of Object.values(m)) {
        if (value?.isTexture) value.dispose();
      }
      m.dispose(); // material.dispose() does NOT dispose its textures
    }
    o.dispose?.(); // per-object renderer state (instancing buffers, etc.)
  });
  root.removeFromParent();
}

// Teardown
renderer.setAnimationLoop(null);
disposeObject(scene);
renderer.dispose(); // GPU resources; the WebGL context stays alive
renderer.forceContextLoss(); // only when discarding the canvas
```

Disposal is manual for shared assets: disposing a texture still used by another material breaks that material. Track reference counts or dispose at the asset-owner level.

## Draw calls and scene cost

```js
// After render; with several passes set renderer.info.autoReset = false and reset once per frame
console.log(renderer.info.render.calls, renderer.info.memory);
```

- Merge static geometry that shares a material (`BufferGeometryUtils.mergeGeometries`), and use `InstancedMesh` for repeats of one object.
- Use `LOD` for distance switching; the renderer calls `update(camera)` each frame.
- Frustum culling tests a bounding sphere. After editing positions call `geometry.computeBoundingSphere()`, and after moving instances/bones far away call `object.computeBoundingSphere()`, or visible objects can be culled.
- Shadow maps are a second render of the scene; disable `castShadow` on small props and shrink the shadow camera frustum.

## WebGPU note

r186 ships `WebGPURenderer` with automatic WebGL 2 fallback, but `renderer.render()` throws until `await renderer.init()` completes, and node materials/TSL replace `ShaderMaterial` there. For a WebGL-first project, stay on `WebGLRenderer`; do not mix examples from the two backends.

## Common mistakes

- `renderer.setPixelRatio(window.devicePixelRatio)` → cap it: `Math.min(devicePixelRatio, 2)`. Unbounded DPR is the most common mobile fill-rate bug.
- `renderer.setSize(w * dpr, h * dpr)` → `setSize(w, h)`; the renderer applies the pixel ratio itself.
- Forgetting `camera.updateProjectionMatrix()` after changing `fov`, `aspect`, `near`, or `far`, so the view never updates.
- `new THREE.Clock()` → `new THREE.Timer()` (Clock deprecated in r183); call `timer.update()` once per frame.
- `renderer.shadowMap.type = THREE.PCFSoftShadowMap` → `THREE.PCFShadowMap` (deprecated in r182; both warn and fall back).
- `mesh.dispose()` and expecting geometry/material/textures freed. It frees only per-object renderer state; traverse and dispose the rest.
- `material.dispose()` with textures still assigned, then rendering the material elsewhere: the textures are freed but still referenced.
- `mesh.layers.set(1)` → `enable(1)`, otherwise the mesh leaves layer 0 where camera and lights live.
- `renderer.outputEncoding = THREE.sRGBEncoding` → `outputColorSpace = SRGBColorSpace` (and it is already the default).
- Loading color textures without `texture.colorSpace = THREE.SRGBColorSpace`, so albedo renders washed out or dark.
- Leaving `renderer.info.autoReset` on while using a composer and reading counts per pass, so numbers reset before you read them.

## See also

- `threejs-shaders-glsl`, `threejs-particles-points`, `threejs-postprocessing`, `threejs-scroll-camera`, `r3f-react-three-fiber`, `webgl-performance-a11y`.
