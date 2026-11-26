import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { isCoarsePointer } from "../lib/motion";
import { stormFragmentShader, stormVertexShader } from "./shaders";

const TAU = Math.PI * 2;
const UP = new Vector3(0, 1, 0);

const EYE_WALL = 0;
const SPIRAL = 1;
const RAIN_BAND = 2;

const seededRandom = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gridHash = (x: number, y: number): number => {
  const value = Math.sin(x * 127.1 + y * 311.7 + 77021) * 43758.5453;
  return value - Math.floor(value);
};

function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const a = gridHash(ix, iy);
  const b = gridHash(ix + 1, iy);
  const c = gridHash(ix, iy + 1);
  const d = gridHash(ix + 1, iy + 1);
  const ab = a + (b - a) * sx;
  const cd = c + (d - c) * sx;
  return ab + (cd - ab) * sy;
}

function potential(x: number, y: number): number {
  return (
    noise2(x, y) * 0.58 +
    noise2(x * 2.03 + 17.2, y * 2.03 - 8.4) * 0.29 +
    noise2(x * 4.11 - 5.8, y * 4.11 + 22.6) * 0.13
  );
}

function curlNoise(x: number, y: number, target: Vector2): Vector2 {
  const epsilon = 0.03;
  const dx =
    (potential(x + epsilon, y) - potential(x - epsilon, y)) /
    (2 * epsilon);
  const dy =
    (potential(x, y + epsilon) - potential(x, y - epsilon)) /
    (2 * epsilon);
  return target.set(dy, -dx).normalize();
}

/**
 * A layered cyclone: a clear eye, a dense eyewall, three curl-perturbed
 * spiral arms and broad rain bands. Every layer lives in one point cloud and
 * one draw call; the disc only supplies the dark eye and a thin wall glow.
 */
export class Storm {
  readonly root = new Group();

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly discGeometry: PlaneGeometry;
  private readonly discMaterial: ShaderMaterial;
  private readonly facing = new Quaternion();
  private readonly faceDir = new Vector3();

  constructor() {
    const random = seededRandom(77021);
    const count = isCoarsePointer ? 2400 : 5600;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const heats = new Float32Array(count);
    const opacities = new Float32Array(count);
    const layers = new Float32Array(count);
    const lifts = new Float32Array(count);

    // Points are projected to physical pixels via `uScale / -viewZ`, so the
    // storm at its closer desktop distance would still read at roughly one
    // pixel on a narrow phone. Lift the per-point size on coarse pointers so
    // the cyclone survives the longer mobile camera pull-back.
    const sizeGain = isCoarsePointer ? 2.35 : 1.15;
    const arms = 3;
    const curl = new Vector2();

    for (let i = 0; i < count; i += 1) {
      const type = random();
      let radius: number;
      let angle: number;
      let heat: number;
      let opacity: number;
      let size: number;
      let layer: number;
      let lift: number;

      if (type < 0.26) {
        // Eyewall: a dense, turbulent ring around the clear eye.
        layer = EYE_WALL;
        radius = 0.135 + Math.pow(random(), 1.7) * 0.105;
        angle = random() * TAU;
        curlNoise(Math.cos(angle) * radius * 5.4, Math.sin(angle) * radius * 5.4, curl);
        radius += curl.x * 0.016;
        angle += curl.y * 0.09;
        heat = 0.9 + random() * 0.1;
        opacity = 0.9 + random() * 0.1;
        size = 0.022 + random() * 0.022;
        lift = 0.012 + random() * 0.014;
      } else if (type < 0.72) {
        // Spiral arms: logarithmic sweeps pushed around by curl noise.
        layer = SPIRAL;
        const arm = Math.floor(random() * arms);
        radius = 0.24 + Math.pow(random(), 0.82) * 0.84;
        angle =
          (arm / arms) * TAU +
          Math.log(radius / 0.24) * 2.25 +
          (random() - 0.5) * (0.16 + radius * 0.18);
        curlNoise(
          Math.cos(angle) * radius * 2.3 + 11.7,
          Math.sin(angle) * radius * 2.3 - 4.9,
          curl,
        );
        angle += curl.x * 0.3 + curl.y * 0.09;
        radius += (random() - 0.5) * 0.045 + curl.y * 0.022;
        heat = 0.55 + random() * 0.35;
        opacity = 0.62 + random() * 0.34;
        size = 0.016 + random() * 0.022;
        lift = 0.006 + random() * 0.02;
      } else {
        // Rain bands: broad outer streamlines with clear moats between them.
        layer = RAIN_BAND;
        radius = 0.34 + Math.pow(random(), 0.78) * 0.98;
        angle = random() * TAU;

        let x = Math.cos(angle) * radius;
        let y = Math.sin(angle) * radius;

        for (let step = 0; step < 5; step += 1) {
          curlNoise(x * 2.6 + step * 0.21, y * 2.6 - step * 0.26, curl);
          x += curl.x * 0.042;
          y += curl.y * 0.042;
        }

        radius = Math.hypot(x, y);
        angle = Math.atan2(y, x);
        const flow = potential(x * 2.9 + 6.3, y * 2.9 - 12.1);
        const band = Math.sin(
          angle * 2.25 - Math.log(Math.max(radius, 0.08)) * 3.6 + flow * 5.6,
        );
        radius += band * 0.062;
        heat = 0.12 + Math.max(0, band) * 0.26 + flow * 0.1;
        opacity = 0.32 + Math.max(0, band) * 0.36 + flow * 0.16;
        size = 0.013 + random() * 0.018;
        lift = (random() - 0.5) * 0.012;
      }

      radii[i] = Math.max(0.135, radius);
      angles[i] = angle;
      seeds[i] = random();
      sizes[i] = size * sizeGain;
      heats[i] = heat;
      opacities[i] = opacity;
      layers[i] = layer;
      lifts[i] = lift;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(positions, 3));
    this.geometry.setAttribute("aRadius", new BufferAttribute(radii, 1));
    this.geometry.setAttribute("aAngle", new BufferAttribute(angles, 1));
    this.geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    this.geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
    this.geometry.setAttribute("aHeat", new BufferAttribute(heats, 1));
    this.geometry.setAttribute("aOpacity", new BufferAttribute(opacities, 1));
    this.geometry.setAttribute("aLayer", new BufferAttribute(layers, 1));
    this.geometry.setAttribute("aLift", new BufferAttribute(lifts, 1));

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
        uIntensity: { value: 0 },
        uHover: { value: 0 },
        uPointer: { value: new Vector2(1e3, 1e3) },
      },
      vertexShader: stormVertexShader,
      fragmentShader: stormFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(this.geometry, this.material);
    points.frustumCulled = false;
    points.renderOrder = 4;

    this.discGeometry = new PlaneGeometry(2.9, 2.9);
    this.discMaterial = new ShaderMaterial({
      uniforms: {
        uIntensity: { value: 0 },
        uTime: { value: 0 },
        uHover: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        uniform float uTime;
        uniform float uHover;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        void main() {
          vec2 p = (vUv - 0.5) * 2.0;
          float d = length(p);
          float angle = atan(p.y, p.x);

          // Spiral shading: the rain bands wrap around the eye instead of
          // sitting as a flat radial gradient.
          float twist = angle * 2.0 - log(max(d, 0.08)) * 3.4 - uTime * 0.16;
          vec2 q = vec2(cos(twist), sin(twist)) * d;
          float n = noise(q * 3.6 + uTime * 0.035);
          float bands = sin(twist * 1.7 + n * 4.2);

          float outer = 1.0 - smoothstep(0.28, 1.0, d);
          float footprint = 1.0 - smoothstep(0.42, 1.0, d);
          float eye = smoothstep(0.105, 0.165, d);
          float eyeFill = 1.0 - smoothstep(0.06, 0.2, d);
          float wall = smoothstep(0.12, 0.2, d) * (1.0 - smoothstep(0.24, 0.36, d));
          float mottle = 0.68 + 0.32 * noise(q * 5.2 + uTime * 0.03);

          vec3 deep = vec3(0.005, 0.02, 0.032);
          vec3 wallColor = vec3(0.26, 0.62, 0.72);
          vec3 color = deep + wallColor * wall * 0.2;
          color += vec3(0.04, 0.13, 0.17) * outer * (0.2 + 0.16 * bands);

          // A dark, mottled cloud shadow occludes the globe underneath, so
          // the arms read as a storm rather than points on top of a map. The
          // eye gets its own soft fill so the bright globe graticule does not
          // streak straight through the calm centre.
          float alpha = uIntensity * eye * (
            footprint * (0.26 + 0.17 * bands + 0.1 * mottle) +
            wall * 0.18
          );
          alpha += uIntensity * eyeFill * 0.5;
          alpha *= 1.0 + uHover * 0.16;
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.78));
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const disc = new Mesh(this.discGeometry, this.discMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.renderOrder = 3;
    disc.frustumCulled = false;
    this.root.add(disc, points);
    this.root.scale.setScalar(1.18);
  }

  resize(heightCss: number, pixelRatio: number): void {
    this.material.uniforms.uScale.value = (heightCss * pixelRatio) / 2;
  }

  setCamera(cameraPosition: Vector3): void {
    this.faceDir.copy(cameraPosition).sub(this.root.position).normalize();
    this.facing.setFromUnitVectors(UP, this.faceDir);
    this.root.quaternion.copy(this.facing);
  }

  update(
    time: number,
    weight: number,
    hover: number,
    pointerLocal: Vector2,
  ): void {
    this.root.visible = weight > 0.004;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uIntensity.value = weight * 1.12;
    this.material.uniforms.uHover.value = hover;
    this.material.uniforms.uPointer.value.copy(pointerLocal);
    this.discMaterial.uniforms.uIntensity.value = weight;
    this.discMaterial.uniforms.uTime.value = time;
    this.discMaterial.uniforms.uHover.value = hover;
  }

  localPoint(world: Vector3, target: Vector2): Vector2 {
    const local = this.root.worldToLocal(world.clone());
    return target.set(local.x, local.z);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.discGeometry.dispose();
    this.discMaterial.dispose();
  }
}
