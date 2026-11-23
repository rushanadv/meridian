---
name: threejs-particles-points
description: "Build GPU-driven particle systems in Three.js with BufferGeometry + Points, per-particle attributes, vertex-shader motion, point-size attenuation, additive blending, and instanced quads when points are not enough. Use when adding dust, sparks, starfields, flow fields, or ambient particles, when particles look square/too small/too slow, or when choosing between Points and instancing."
license: MIT
---

Written for this project. Targets three.js r186; point-size limits and precision differ per GPU, so verify on real devices.

# Three.js Particles

## Points with a standard material

```js
import * as THREE from "three";

const COUNT = 2000;
const positions = new Float32Array(COUNT * 3);
const colors = new Float32Array(COUNT * 3);

for (let i = 0; i < COUNT; i++) {
  positions[i * 3 + 0] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 20;

  const t = Math.random();
  colors[i * 3 + 0] = 1 - t;      // warm → cool
  colors[i * 3 + 1] = 0.6;
  colors[i * 3 + 2] = t;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const material = new THREE.PointsMaterial({
  size: 0.08,
  sizeAttenuation: true,     // size shrinks with distance (perspective)
  vertexColors: true,
  transparent: true,
  opacity: 0.8,
  depthWrite: false,         // additive/transparent points must not occlude each other
  blending: THREE.AdditiveBlending,
  toneMapped: false,         // keep additive highlights out of tone mapping if desired
});

const points = new THREE.Points(geometry, material);
points.frustumCulled = false; // bounds are static while the shader moves points
scene.add(points);
```

`PointsMaterial` draws screen-aligned squares with `gl_PointCoord` applied to a circular alpha map or a generated sprite. `depthWrite: false` plus additive blending is the standard glow look; without it, points fight the depth buffer and sort incorrectly.

## Shader-driven points (recommended for motion)

```js
const COUNT = 4000;
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
const sizes = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i++) {
  positions.set([
    (Math.random() - 0.5) * 24,
    (Math.random() - 0.5) * 14,
    (Math.random() - 0.5) * 24,
  ], i * 3);
  seeds[i] = Math.random();
  sizes[i] = 0.04 + Math.random() * 0.12;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

const uniforms = {
  uTime: { value: 0 },
  uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  uScale: { value: window.innerHeight * 0.5 }, // half the drawing-buffer height
  uMouse: { value: new THREE.Vector2(0.5, 0.5) },
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPixelRatio;
    uniform float uScale;
    uniform vec2 uMouse;
    attribute float aSeed;
    attribute float aSize;
    varying float vSeed;
    varying float vFade;

    void main() {
      vSeed = aSeed;
      vec3 pos = position;

      // GPU motion: slow curl-like drift + per-particle offset
      float t = uTime * (0.15 + aSeed * 0.25);
      pos.x += sin(t + aSeed * 6.2831) * 0.6;
      pos.y += cos(t * 0.8 + aSeed * 12.566) * 0.4;
      pos.z += sin(t * 0.5 + aSeed * 9.42) * 0.5;

      // Subtle attraction around the pointer in screen space
      pos.xy += (uMouse - 0.5) * 0.3 * aSeed;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Point-size attenuation: world-ish size that halves every 2× distance
      gl_PointSize = aSize * uScale * uPixelRatio / -mvPosition.z;

      vFade = smoothstep(-12.0, -2.0, mvPosition.z); // fade in the distance
    }`,
  fragmentShader: /* glsl */ `
    varying float vSeed;
    varying float vFade;

    void main() {
      // Circular, soft sprite from gl_PointCoord (range 0..1)
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if (d > 0.5) discard;

      float alpha = 1.0 - smoothstep(0.15, 0.5, d); // soft edge, opaque core
      vec3 color = mix(vec3(0.45, 0.65, 1.0), vec3(1.0, 0.62, 0.35), vSeed);
      gl_FragColor = vec4(color, alpha * vFade * 0.9);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});

const points = new THREE.Points(geometry, material);
points.frustumCulled = false;
scene.add(points);

const timer = new THREE.Timer();
timer.connect(document);

function resize() {
  uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  uniforms.uScale.value = window.innerHeight * uniforms.uPixelRatio.value * 0.5;
}
window.addEventListener("resize", resize);

renderer.setAnimationLoop(() => {
  timer.update();
  uniforms.uTime.value = timer.getElapsed();
  renderer.render(scene, camera);
});
```

Notes:

- `gl_PointSize` is compared to the implementation's `ALIASED_POINT_SIZE_RANGE`; values above it clamp, and very large points cost fill rate even when mostly transparent. Keep sizes under ~64 px for dense systems.
- `uScale = drawingBufferHeight / 2` gives a point whose screen size is roughly its world size at 1 unit distance. Adjust for your scene scale.
- `frustumCulled = false` because CPU bounds do not know about shader displacement. Alternatively expand `geometry.boundingSphere` once.

## Additive blending

```js
material.transparent = true;
material.depthWrite = false;
material.depthTest = true;         // keep tested against solid geometry
material.blending = THREE.AdditiveBlending;
```

- Additive means `dst + src`; overlapping particles saturate to white. Keep per-particle alpha low (0.05–0.3) and reduce the count before increasing brightness.
- With true additive light, avoid `toneMapped: false` unless you deliberately want highlights untouched; mixing tone-mapped geometry and untonemapped particles reads as a separate layer.
- `NormalBlending` with `depthWrite: false` needs back-to-front sorting; points are not sorted per particle. Additive and premultiplied looks hide this better.
- If particles must go behind and in front of objects, keep `depthTest: true` and accept hard intersections, or render soft particles with a depth texture.

## Instancing vs Points

| Need | Use |
|---|---|
| Round/soft dots, thousands, screen-aligned | `Points` + `ShaderMaterial` |
| Textured sprites with rotation/scale per particle | `InstancedMesh` of a quad (or `InstancedBufferGeometry`) |
| Per-particle arbitrary 3D orientation | Instanced quads with a per-instance quaternion |
| Lighting/normals on each particle | `InstancedMesh` with a lit material |
| WebGPU/TSL | `SpriteNodeMaterial` or instanced node materials |

```js
// Instanced quads when Points is too limited (shapes, rotation, big sprites)
const geo = new THREE.PlaneGeometry(1, 1);
const inst = new THREE.InstancedMesh(geo, spriteMaterial, COUNT);
const dummy = new THREE.Object3D();
for (let i = 0; i < COUNT; i++) {
  dummy.position.set(px[i], py[i], pz[i]);
  dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() * Math.PI * 2);
  dummy.scale.setScalar(0.1 + Math.random() * 0.2);
  dummy.updateMatrix();
  inst.setMatrixAt(i, dummy.matrix);
}
inst.instanceMatrix.needsUpdate = true;
```

To animate instances on the GPU, either write `aSeed`/`aOffset` as `InstancedBufferAttribute` and displace in a custom vertex shader, or update `instanceMatrix` on the CPU only when needed (not per frame for thousands).

## Particle counts and budget

| Device | Points budget (simple shader) | Notes |
|---|---|---|
| Desktop dGPU | 50k–200k | Fill rate is the limit, not vertex count |
| Integrated laptop | 10k–50k | Cap DPR at 1.5–2 |
| Recent phone | 5k–20k | Additive overdraw kills fill rate first |
| Low-end phone | 1k–5k | Consider a static texture/poster |

Reduce count and size before reducing effects: particle overdraw is the dominant mobile cost. See `webgl-performance-a11y`.

## Common mistakes

- Leaving `depthWrite: true` on transparent/additive particles → invisible sorting artifacts and hard occlusion.
- `sizeAttenuation: false` and expecting depth scaling; it renders constant pixel size.
- Using `gl_PointSize` in a mesh vertex shader → no effect; it is a point primitive feature.
- Passing pixel sizes directly to `gl_PointSize` without `uPixelRatio`/`uScale` → tiny on HiDPI or huge on mobile.
- Rebuilding `BufferGeometry` each frame to move particles → upload cost; move them in the vertex shader with `uTime`.
- Forgetting `frustumCulled = false` when shader displacement moves points outside CPU bounds → the whole cloud disappears at some camera angles.
- Sizes above the GPU point-size limit silently clamp; test large points on mobile.
- Additive blending with full alpha → white blobs. Lower alpha and count.
- Animating `uTime` with `Clock` (deprecated r183) → use `Timer`.
- Splitting one 100k system into many `Points` objects for “optimization” → more draw calls, not fewer.

## See also

- `threejs-shaders-glsl` (noise, curl, tone mapping includes), `threejs-fundamentals` (DPR, disposal), `webgl-performance-a11y` (mobile fallbacks and reduced motion).
