import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { isCoarsePointer } from "../lib/motion";
import { stormFragmentShader, stormVertexShader } from "./shaders";

const TAU = Math.PI * 2;

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

function curlNoise(x: number, y: number): Vector2 {
  const epsilon = 0.025;
  const dx =
    (potential(x + epsilon, y) - potential(x - epsilon, y)) /
    (2 * epsilon);
  const dy =
    (potential(x, y + epsilon) - potential(x, y - epsilon)) /
    (2 * epsilon);
  return new Vector2(dy, -dx).normalize();
}

export class Storm {
  readonly root = new Group();

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly discGeometry: PlaneGeometry;
  private readonly discMaterial: ShaderMaterial;

  constructor() {
    const random = seededRandom(77021);
    const count = isCoarsePointer ? 1150 : 2500;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const heats = new Float32Array(count);
    const opacities = new Float32Array(count);
    const layers = new Float32Array(count);
    const arms = 4;

    for (let i = 0; i < count; i += 1) {
      const type = random();
      let radius: number;
      let angle: number;
      let heat: number;
      let opacity: number;
      let size: number;
      let layer: number;

      if (type < 0.26) {
        layer = 0;
        radius = 0.16 + Math.pow(random(), 0.8) * 0.14;
        angle = random() * TAU;
        heat = 1;
        opacity = 0.95;
        size = 0.026 + random() * 0.025;
      } else if (type < 0.68) {
        layer = 1;
        radius = 0.27 + Math.pow(random(), 0.92) * 0.65;
        const arm = Math.floor(random() * arms);
        const baseAngle =
          (arm / arms) * TAU + Math.log(radius / 0.27) * 2.8;
        const curl = curlNoise(
          Math.cos(baseAngle) * radius * 2.6,
          Math.sin(baseAngle) * radius * 2.6,
        );
        angle = baseAngle + (random() - 0.5) * 0.43 + curl.x * 0.33;
        heat = 0.56 + random() * 0.22;
        opacity = 0.7 + random() * 0.25;
        size = 0.018 + random() * 0.026;
      } else {
        layer = 2;
        radius = 0.42 + Math.pow(random(), 0.82) * 0.72;
        angle = random() * TAU;
        let x = Math.cos(angle) * radius;
        let y = Math.sin(angle) * radius;

        for (let step = 0; step < 4; step += 1) {
          const curl = curlNoise(x * 2.8 + step * 0.19, y * 2.8 - step * 0.23);
          x += curl.x * 0.035;
          y += curl.y * 0.035;
        }

        radius = Math.hypot(x, y);
        angle = Math.atan2(y, x);
        const flow = potential(x * 3.2 + 4.1, y * 3.2 - 9.7);
        const band = Math.sin(angle * 3.2 - Math.log(radius) * 4.3 + flow * 5.2);
        radius += band * 0.055;
        heat = 0.16 + flow * 0.2;
        opacity = 0.35 + flow * 0.32;
        size = 0.015 + random() * 0.024;
      }

      radii[i] = Math.max(0.15, radius);
      angles[i] = angle;
      seeds[i] = random();
      sizes[i] = size;
      heats[i] = heat;
      opacities[i] = opacity;
      layers[i] = layer;
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

    this.discGeometry = new PlaneGeometry(2.7, 2.7);
    this.discMaterial = new ShaderMaterial({
      uniforms: {
        uIntensity: { value: 0 },
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
        varying vec2 vUv;

        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float eye = 1.0 - smoothstep(0.1, 0.24, d);
          float wall = smoothstep(0.14, 0.22, d) * (1.0 - smoothstep(0.29, 0.42, d));
          float haze = 1.0 - smoothstep(0.36, 1.0, d);
          vec3 deep = vec3(0.012, 0.027, 0.04);
          vec3 wallColor = vec3(0.12, 0.42, 0.5);
          vec3 color = mix(deep, wallColor, wall * 0.55 + haze * 0.08);
          float alpha = (1.0 - smoothstep(0.5, 1.0, d)) * uIntensity * (0.62 + wall * 0.14);
          alpha *= mix(0.68, 1.0, eye);
          gl_FragColor = vec4(color, alpha);
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
    this.root.rotation.set(0.42, 0.1, 0.12);
    this.root.scale.setScalar(1.05);
  }

  resize(heightCss: number, pixelRatio: number): void {
    this.material.uniforms.uScale.value = (heightCss * pixelRatio) / 2;
  }

  update(
    time: number,
    weight: number,
    hover: number,
    pointerLocal: Vector2,
  ): void {
    this.root.visible = weight > 0.004;
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uIntensity.value = weight * 1.05;
    this.discMaterial.uniforms.uIntensity.value = weight;
    this.material.uniforms.uHover.value = hover;
    this.material.uniforms.uPointer.value.copy(pointerLocal);
    this.root.scale.setScalar(1.02 + weight * 0.06);
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
