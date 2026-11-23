---
name: threejs-shaders-glsl
description: "Write custom GLSL for Three.js: choose ShaderMaterial vs RawShaderMaterial, declare uniforms/varyings/attributes, animate on the GPU with uTime, pass pointer and resolution uniforms, and build simplex/curl noise, fbm, fresnel, and vertex displacement. Use when a built-in material cannot express the look, when adding noise/distortion/rim light, when uniforms do not update, or when custom shader output looks wrong under tone mapping."
license: MIT
---

Written for this project. Targets three.js r186 with `WebGLRenderer` and GLSL ES 1.00 (three's default for `ShaderMaterial`). Verify version-specific `#include` chunk names against the installed three package if you upgrade.

# Three.js Shaders + GLSL

## ShaderMaterial vs RawShaderMaterial

| | `ShaderMaterial` | `RawShaderMaterial` |
|---|---|---|
| Built-in uniforms/attributes | Injects `projectionMatrix`, `modelViewMatrix`, `normalMatrix`, `modelMatrix`, `viewMatrix`, `cameraPosition`, `position`, `normal`, `uv` | None; declare every attribute/uniform/precision yourself |
| `#include <chunk>` | Yes | Yes, but chunks relying on injected uniforms need those declared |
| When | Almost always | Custom attribute layouts, unusual precision, or full control of the prefix |
| Output | `gl_FragColor` in GLSL1 | `gl_FragColor` in GLSL1; `out vec4` if you set `glslVersion: THREE.GLSL3` |
| Tone mapping / color space | Add the chunks yourself; otherwise output is raw linear | Manual |

```js
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAmplitude: { value: 0.3 },
  },
  vertexShader,
  fragmentShader,
  transparent: true,
  side: THREE.DoubleSide,
});
```

Keep the uniforms object on the material and mutate `.value`; assigning a new uniforms object per frame forces a program/uniform refresh and is a common leak.

## Uniforms, varyings, attributes

```glsl
// vertex
uniform float uTime;
uniform vec2 uMouse;

attribute float aSeed;      // extra BufferAttribute (ShaderMaterial injects the core ones)

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;

// fragment
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vWorldPos;
varying vec3 vNormalW;
```

- `varying` values are interpolated per fragment; keep them few (each consumes a slot).
- In GLSL3 (`glslVersion: THREE.GLSL3`) replace `attribute`/`varying` with `in`/`out` and write `out vec4 fragColor`. Do not mix the two dialects.
- `uResolution` should be drawing-buffer pixels (`renderer.getDrawingBufferSize`), not CSS pixels, when used for aspect or pixel-size math.

## Passing time and pointer

```js
const pointer = new THREE.Vector2(0.5, 0.5);
const smooth = new THREE.Vector2(0.5, 0.5);
let firstMove = true;

window.addEventListener("pointermove", (e) => {
  pointer.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
  if (firstMove) { smooth.copy(pointer); firstMove = false; }
});

const timer = new THREE.Timer();
timer.connect(document);

renderer.setAnimationLoop(() => {
  timer.update();
  smooth.lerp(pointer, 0.08); // damp so the pointer feels weighty
  material.uniforms.uTime.value = timer.getElapsed();
  material.uniforms.uMouse.value.copy(smooth);
  // resize: material.uniforms.uResolution.value.set(w * dpr, h * dpr)
  renderer.render(scene, camera);
});
```

Normalize pointer to 0–1 and multiply by aspect in the shader if you need circular distance:

```glsl
vec2 p = (vUv - uMouse) * vec2(uResolution.x / uResolution.y, 1.0);
float d = length(p);
```

Do not upload geometry attributes every frame to animate; put the motion in the vertex shader and change only uniforms.

## Vertex displacement and fresnel rim

```glsl
// vertex
uniform float uTime;
uniform float uAmplitude;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 pos = position;
  float n = snoise(vec3(pos.xy * 1.6, uTime * 0.25));
  pos += normal * n * uAmplitude;

  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal); // exact for uniform scale
  gl_Position = projectionMatrix * viewMatrix * world;
}
```

```glsl
// fragment
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec3 vNormalW;
varying vec3 vWorldPos;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(dot(viewDir, normalize(vNormalW)), 0.0, 1.0), 3.0);
  vec3 color = mix(uColorA, uColorB, fresnel);
  gl_FragColor = vec4(color, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
```

Include those two chunks after `gl_FragColor` whenever the renderer uses tone mapping or sRGB output (the default). Skip them for a deliberately raw look, and handle conversion manually in `RawShaderMaterial`. Non-uniform scale needs the inverse-transpose (`normalMatrix` is view-space); for displacement, per-vertex normals on a low-poly mesh will look faceted by design.

## Simplex, curl, fbm

The 3D simplex noise below is the Ashima Arts / Stefan Gustavson implementation (MIT), renamed to avoid collisions with three's chunks.

```glsl
vec3 snMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 snMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 snPermute(vec4 x) { return snMod289(((x * 34.0) + 1.0) * x); }
vec4 snTaylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = snMod289(i);
  vec4 p = snPermute(snPermute(snPermute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = snTaylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
```

```glsl
// fbm: 4 octaves, fixed loop bound (mobile-safe)
float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    sum += amp * snoise(p * freq);
    freq *= 2.02; // non-integer avoids aligned octaves
    amp *= 0.5;
  }
  return sum;
}

// curl noise: divergence-free vector field from a noise potential
vec3 snoiseVec3(vec3 p) {
  return vec3(snoise(p), snoise(p + vec3(17.1, 31.7, 7.3)), snoise(p + vec3(43.2, 11.9, 23.4)));
}

vec3 curlNoise(vec3 p) {
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 px0 = snoiseVec3(p - dx), px1 = snoiseVec3(p + dx);
  vec3 py0 = snoiseVec3(p - dy), py1 = snoiseVec3(p + dy);
  vec3 pz0 = snoiseVec3(p - dz), pz1 = snoiseVec3(p + dz);
  float x = py1.z - py0.z - pz1.y + pz0.y;
  float y = pz1.x - pz0.x - px1.z + px0.z;
  float z = px1.y - px0.y - py1.x + py0.x;
  return normalize(vec3(x, y, z) / (2.0 * e));
}
```

Curl is 18 `snoise` calls; use it in the vertex shader with modest vertex counts, or bake the field into a texture/attribute for large meshes. Cheaper fake: three float-noise samples for a “swirl” that is not divergence-free but visually close.

## GPU-side animation patterns

```glsl
// Flowing distortion in the fragment shader: no geometry updates
vec2 warped = vUv;
warped += curlNoise(vec3(vUv * 2.0, uTime * 0.2)).xy * 0.02;
vec3 color = texture2D(uMap, warped).rgb;
```

- Keep per-frame CPU work to uniform writes. Do not call `setAttribute`/`needsUpdate` unless the data truly changes.
- For per-instance variation add an `InstancedBufferAttribute` (e.g. `aSeed`, `aOffset`) and read it as `attribute` in the vertex shader; the instance matrix is injected as `instanceMatrix` for `InstancedMesh`.
- `material.uniformsNeedUpdate = true` is only needed after replacing uniform *objects*, not after mutating `.value`.
- Cache compiled materials: one `ShaderMaterial` per look, shared across meshes, avoids shader recompilation stalls.

## Performance

- Fill rate dominates: full-screen noise/fbm costs more than a whole low-poly scene. Cap fbm at 3–4 octaves and skip it on mobile.
- Avoid dynamic loops and `discard`; both defeat early-Z and can be slow on tile-based GPUs.
- Branch on uniforms (coherent across the draw) rather than per-fragment noise comparisons.
- Use `precision mediump float` in the fragment shader on mobile unless banding appears.
- Profile with `renderer.info` and a GPU timer; shader cost does not show in JS timings.

## Common mistakes

- Using `ShaderMaterial` and omitting `<tonemapping_fragment>` / `<colorspace_fragment>` → washed-out or double-graded output. Add them after `gl_FragColor`, or accept raw linear deliberately.
- Passing pointer in pixels → normalize to 0–1 (and multiply x by aspect for circles).
- Recreating `uniforms` or the material each frame → shader recompiles and memory leaks; mutate `.value`.
- Animating geometry attributes per frame instead of using `uTime` in the vertex shader → CPU upload cost and no benefit.
- Using `Clock` for time → `Timer` (Clock deprecated r183); update it once per frame.
- `gl_PointSize` in a mesh shader has no effect; point sizing belongs to `Points` (see `threejs-particles-points`).
- Mixing GLSL1 `attribute`/`varying` with `glslVersion: THREE.GLSL3` `in`/`out` → compile error.
- Expecting `normal` to be smooth on low-poly geometry, or using `mat3(modelMatrix)` under non-uniform scale → wrong lighting; use `normalMatrix` for view-space normals.
- Forgetting `#include <common>` when a chunk you include depends on helpers (e.g. some lighting chunks), or defining names that collide with them.
- Loops with a non-constant bound in GLSL1 → compile failure; use a fixed count and `break` if needed.
- Leaving `transparent: true` on opaque shader materials → sorting cost and depth-write surprises.

## See also

- `threejs-particles-points`, `threejs-postprocessing` (custom `ShaderPass`), `threejs-fundamentals` (renderer color settings), `webgl-performance-a11y`.
