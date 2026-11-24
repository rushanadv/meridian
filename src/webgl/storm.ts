import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Float32BufferAttribute,
  Group, LineBasicMaterial, LineLoop, Mesh, PlaneGeometry, Points,
  ShaderMaterial, Vector2, Vector3,
} from "three";
import { isCoarsePointer } from "../lib/motion";
import { stormFragmentShader, stormVertexShader } from "./shaders";

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

const TAU = Math.PI * 2;

export class Storm {
  readonly root = new Group();

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly discGeometry: PlaneGeometry;
  private readonly discMaterial: ShaderMaterial;
  private readonly rings: { geometry: BufferGeometry; material: LineBasicMaterial }[] =
    [];

  constructor() {
    const random = seededRandom(77021);
    const count = isCoarsePointer ? 900 : 1800;

    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);

    const arms = 3;

    for (let i = 0; i < count; i += 1) {
      const arm = i % arms;
      const radius = 0.055 + Math.pow(random(), 1.35) * 0.98;
      const angle =
        (arm / arms) * TAU +
        radius * 5.6 +
        (random() - 0.5) * (0.14 + radius * 0.16);

      radii[i] = radius;
      angles[i] = angle;
      seeds[i] = random();
      sizes[i] = 0.021 + (1 - radius) * 0.02 + random() * 0.012;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "aRadius",
      new BufferAttribute(radii, 1),
    );
    this.geometry.setAttribute(
      "aAngle",
      new BufferAttribute(angles, 1),
    );
    this.geometry.setAttribute(
      "aSeed",
      new BufferAttribute(seeds, 1),
    );
    this.geometry.setAttribute(
      "aSize",
      new BufferAttribute(sizes, 1),
    );

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
          float a = (1.0 - smoothstep(0.22, 1.0, d)) * 0.5 * uIntensity;
          vec3 color = mix(vec3(0.05, 0.11, 0.13), vec3(0.012, 0.03, 0.05), d);
          gl_FragColor = vec4(color, a);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const disc = new Mesh(this.discGeometry, this.discMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.renderOrder = 3;
    disc.frustumCulled = false;
    this.root.add(disc);

    for (const radius of [0.42, 0.74, 0.96]) {
      const segments = 96;
      const values: number[] = [];

      for (let i = 0; i < segments; i += 1) {
        const angle = (i / segments) * TAU;
        values.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute(
        "position",
        new Float32BufferAttribute(values, 3),
      );

      const material = new LineBasicMaterial({
        color: "#7fe7ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      });

      const ring = new LineLoop(geometry, material);
      ring.renderOrder = 4;
      ring.frustumCulled = false;

      this.rings.push({ geometry, material });
      this.root.add(ring);
    }

    this.root.add(points);
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

    for (const ring of this.rings) {
      ring.material.opacity = weight * (0.05 + hover * 0.12);
    }
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

    for (const ring of this.rings) {
      ring.geometry.dispose();
      ring.material.dispose();
    }
  }
}
