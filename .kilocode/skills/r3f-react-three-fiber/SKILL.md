---
name: r3f-react-three-fiber
description: "Build Three.js scenes as React components with React Three Fiber and drei: Canvas setup, useFrame, useThree, Suspense asset loading, pointer events, instancing, adaptive DPR, disposal, and avoiding per-frame React re-renders. Use when writing React code that renders 3D, wiring drei helpers, debugging a Canvas that never updates, or deciding whether R3F or vanilla Three.js fits the project."
license: MIT
---

Source: https://github.com/cloudai-x/threejs-skills (MIT), trimmed for this project. Targets `@react-three/fiber` 9.8, `@react-three/drei` 10.7, React 19, three r186.

# React Three Fiber

## Quick start

The Canvas owns the renderer, scene, and camera, and fills its parent element — give the parent a height. Three objects become JSX: lowercase tag, capitalized class.

```jsx
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

function Box() {
  const ref = useRef();
  useFrame((_, delta) => {
    ref.current.rotation.y += delta; // mutate, never setState here
  });
  return (
    <mesh ref={ref} position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#d9915b" />
    </mesh>
  );
}

export default function App() {
  return (
    <Canvas shadows="percentage" camera={{ position: [3, 2, 4], fov: 50 }} dpr={[1, 2]}>
      <color attach="background" args={["#111827"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 2]} intensity={2} castShadow />
      <Box />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#20293a" />
      </mesh>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
```

- `dpr={[1, 2]}` clamps against `devicePixelRatio`; do not pass a raw DPR number above 2.
- `shadows="percentage"` selects the non-deprecated soft filter; bare `shadows` maps to `PCFSoftShadowMap`, which r182 swaps for `PCFShadowMap` with a warning.
- Fiber applies `ACESFilmicToneMapping` by default, unlike plain three. `flat` sets `NoToneMapping`.
- `camera`, `gl`, `events`, and `eventPrefix` are the escape hatches; `onCreated` gets the renderer once.

## Scene graph rules

```jsx
<mesh position={[1, 2, 3]} rotation-x={0.4} material-color="#42699c" />
```

- `args` is the constructor argument list; changing it rebuilds the object.
- Props with `.set()` accept shorthands: array, `Vector3`, or scalar. Do not pass a plain object to `position`; it is a read-only Vector3 and throws.
- Dashed props pierce (`rotation-x`, `material-color`); `attach="material-0"` targets array slots.
- Mount an existing object with `<primitive object={obj} />`; fiber never disposes primitives, and one object goes in one primitive.
- Register addon classes: `extend({ Water })`, then `<water args={[geometry]} />`. In TypeScript use `threeLine`, `threeAudio`, etc. for DOM-colliding tags.

## Frame loop and state without re-renders

```jsx
function Spinner({ radius = 2 }) {
  const ref = useRef();
  useFrame((state, delta) => {
    ref.current.rotation.y += delta;
    ref.current.position.x = Math.sin(state.clock.elapsedTime) * radius;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.4, 32, 16]} />
      <meshBasicMaterial color="#e8b4a0" />
    </mesh>
  );
}
```

- `useFrame(cb, priority?)` runs before the scene renders. A positive priority takes over rendering; then you must call `state.gl.render(state.scene, state.camera)` yourself or the scene is black.
- Never call `setState` inside `useFrame`; a state update re-renders React every frame. Mutate refs, or use a store read outside the loop.
- `useThree(selector)` subscribes reactively; with no selector it returns the whole state. Inside `useFrame`, use the `state` argument instead to avoid subscriptions.
- `state.clock` is fiber's own `THREE.Clock` (it logs the r183 deprecation itself). Use `state.clock.elapsedTime`, not `getElapsedTime()`, which consumes delta.

Under `frameloop="demand"`, React prop changes invalidate automatically but imperative mutations do not:

```jsx
const ref = useRef();
const invalidate = useThree((s) => s.invalidate);
ref.current.rotation.y += 0.5;
invalidate();
```

## Suspense and assets

```jsx
import { Suspense } from "react";
import { useProgress, useGLTF, Environment } from "@react-three/drei";

function Model({ url }) {
  const { scene } = useGLTF(url); // suspends; cached by URL
  return <primitive object={scene} />;
}

function Hud() {
  const { active, progress } = useProgress();
  return <div>{active ? `${progress.toFixed(0)}%` : "ready"}</div>;
}

<Canvas camera={{ position: [3, 2, 4], fov: 50 }}>
  <Suspense fallback={null}>
    <Environment preset="city" />
    <Model url="model.glb" />
  </Suspense>
</Canvas>
```

- `useGLTF` enables Draco/meshopt and caches; `useGLTF.preload(url)` warms it.
- `useTexture` sets sRGB on color maps assigned through props, so albedo works without manual `colorSpace`.
- For several skinned copies, clone with `useMemo(() => SkeletonUtils.clone(scene), [scene])` (`three/addons/utils/SkeletonUtils.js`); `Object3D.clone()` shares one skeleton.
- `<Preload all />` compiles materials and uploads textures once, trading a startup stall for no first-view hitch.

## drei helpers worth knowing

- `OrbitControls makeDefault` wires frame updates, invalidation, damping, and disposal; `makeDefault` exposes it as `state.controls` for `Bounds`. Raw `new OrbitControls(...)` does none of that.
- `Environment preset` / `files` sets `scene.environment` without geometry. Under WebGPU, the children/`Lightformer` bake is not WebGL-fallback safe.
- `ContactShadows frames={1}` bakes a soft contact shadow for still scenes (uses an `onBeforeCompile` material; not WebGPU-safe).
- `<Instances>` + `<Instance>` render many copies in one draw call; each `Instance` is a transform (and optional color).
- `Text` is SDF text (troika; not WebGPU-safe); `Html` projects DOM into the scene — pass `portal` to a overlay div when it mounts with its Canvas.
- `Bounds` + `useBounds()` fit the camera to children; `Center` recenters on bounds and misplaces drei `Text`.

## Performance

```jsx
// Lower resolution while controls move, restore after
<Canvas dpr={[1, 2]}>
  <OrbitControls regress />
  <AdaptiveDpr pixelated />
</Canvas>

// Or drive dpr from measured frame rate
const [dpr, setDpr] = useState([1, 2]);
<Canvas dpr={dpr}>
  <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr([1, 2])} />
</Canvas>
```

- Cap `dpr`, prefer on-demand rendering for static scenes, instance repeated geometry, merge static meshes, and use `Detailed` (LOD) for far-field detail.
- `PerformanceMonitor` only samples; it does not change resolution. Drive the Canvas `dpr` prop through state, and keep `AdaptiveDpr` out of that Canvas or the next drag overrides it.
- Do not mount a second `requestAnimationFrame` loop; it races the Canvas and bypasses fiber's effects.

## Disposal

Fiber disposes what it creates on unmount (idle-scheduled): elements, their JSX-declared geometry/material/texture children, and a renderer it built. It does not dispose objects passed through props, primitives, or assets cached by `useLoader`/`useGLTF`; dispose those yourself. `dispose={null}` opts an element and its children out.

```jsx
import { dispose } from "@react-three/fiber";
dispose(mesh); // mesh + its own geometry/material; does not traverse children
```

## R3F or vanilla Three.js?

Choose R3F when the app is already React, state and UI must drive the scene, or drei helpers (controls, environment, Html, instancing) save real work. Choose vanilla when the scene is one large imperative experience with its own loop, when you need minimal React overhead, or when the render loop is driven by a non-React system (GSAP ScrollTrigger) and React would only wrap it. R3F and ScrollTrigger can coexist: drive progress with `ScrollTrigger` into a ref/store, and read it in `useFrame` instead of re-rendering.

## Common mistakes

- `requestAnimationFrame(tick)` alongside the Canvas → use `useFrame`.
- `useFrame(() => { ref.current.rotation.y += 0.01 })` → use the `delta` argument; fixed increments change speed with refresh rate.
- `setState` inside `useFrame` → mutate refs; React re-render per frame destroys performance.
- `useFrame(cb, 1)` without rendering → positive priority stops the Canvas render; either drop the priority or call `gl.render` yourself.
- `<mesh position={{ x: 1, y: 0, z: 0 }} />` → pass an array or Vector3; a plain object throws on the read-only Vector3.
- `scene.add(gltf.scene)` → `<primitive object={gltf.scene} />`; imperative adds take no fiber props and survive unmount.
- `useGLTF(url).scene.clone()` for skinned models → `SkeletonUtils.clone` inside `useMemo`.
- `<Canvas shadows>` → `shadows="percentage"` to avoid the r182 deprecation warning.
- Mutating under `frameloop="demand"` without `invalidate()` → the screen never updates.
- Raw `new OrbitControls(camera, canvas)` → `<OrbitControls makeDefault />` for updates, invalidation, and disposal.
- `<line>` / `<path>` in TypeScript → `threeLine` / `threePath`.

## See also

- `threejs-fundamentals`, `threejs-shaders-glsl`, `threejs-scroll-camera`, `webgl-performance-a11y`.
