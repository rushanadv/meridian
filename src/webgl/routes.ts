import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture,
  Float32BufferAttribute, Group, LineSegments, MathUtils, Points, PointsMaterial,
  ShaderMaterial, Vector3,
} from "three";
import { routeFragmentShader, routeVertexShader } from "./shaders";

const DEG = Math.PI / 180;
const RADIUS = 2;

interface Port {
  lat: number;
  lon: number;
}

interface Lane {
  from: Port;
  to: Port;
}

const LANES: Lane[] = [
  { from: { lat: 31.2, lon: 121.5 }, to: { lat: 51.95, lon: 4.48 } },
  { from: { lat: 1.29, lon: 103.85 }, to: { lat: 33.74, lon: -118.27 } },
  { from: { lat: -23.96, lon: -46.33 }, to: { lat: 31.2, lon: 121.5 } },
];

const toVector = (port: Port): Vector3 => {
  const lat = port.lat * DEG;
  const lon = port.lon * DEG;
  return new Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  );
};

export class Routes {
  readonly group = new Group();

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly portGeometry: BufferGeometry;
  private readonly portMaterial: PointsMaterial;
  private readonly pulseGeometry: BufferGeometry;
  private readonly pulseMaterial: PointsMaterial;
  private readonly pulsePositions: Float32Array;
  private readonly pulseSamples: Vector3[][];
  private readonly pulseTexture: CanvasTexture;
  private active = 0;
  private focus = 0;
  private focusTarget = 1;

  constructor() {
    const positions: number[] = [];
    const progresses: number[] = [];
    const routes: number[] = [];
    const seeds: number[] = [];
    const steps = 110;
    const lanesForPulse: Vector3[][] = [];

    LANES.forEach((lane, routeIndex) => {
      const start = toVector(lane.from);
      const end = toVector(lane.to);
      const seed = 0.17 + routeIndex * 0.31;

      const samples: Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const dir = start
          .clone()
          .multiplyScalar(1 - t)
          .addScaledVector(end, t)
          .normalize();
        const radius = RADIUS + 0.06 + Math.sin(Math.PI * t) * 0.22;
        samples.push(new Vector3(dir.x * radius, dir.y * radius, dir.z * radius));
      }
      lanesForPulse.push(samples);

      for (let i = 0; i < steps; i += 1) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;

        for (const t of [t0, t1]) {
          const dir = start
            .clone()
            .multiplyScalar(1 - t)
            .addScaledVector(end, t)
            .normalize();

          const lift = 0.06 + Math.sin(Math.PI * t) * 0.22;
          const radius = RADIUS + lift;

          positions.push(dir.x * radius, dir.y * radius, dir.z * radius);
          progresses.push(t);
          routes.push(routeIndex);
          seeds.push(seed);
        }
      }
    });

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "aProgress",
      new Float32BufferAttribute(progresses, 1),
    );
    this.geometry.setAttribute(
      "aRoute",
      new Float32BufferAttribute(routes, 1),
    );
    this.geometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(seeds, 1),
    );

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uIntensity: { value: 0 },
        uActive: { value: 0 },
        uFocus: { value: 0 },
      },
      vertexShader: routeVertexShader,
      fragmentShader: routeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const lines = new LineSegments(this.geometry, this.material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;

    const halo = new LineSegments(this.geometry, this.material);
    halo.frustumCulled = false;
    halo.renderOrder = 3;
    halo.scale.setScalar(1.008);

    const portPositions: number[] = [];

    LANES.forEach((lane) => {
      for (const port of [lane.from, lane.to]) {
        const dir = toVector(port);
        const radius = RADIUS + 0.06;
        portPositions.push(dir.x * radius, dir.y * radius, dir.z * radius);
      }
    });

    this.portGeometry = new BufferGeometry();
    this.portGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(portPositions, 3),
    );

    this.portMaterial = new PointsMaterial({
      color: "#7fe7ff",
      size: 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const ports = new Points(this.portGeometry, this.portMaterial);
    ports.frustumCulled = false;
    ports.renderOrder = 4;

    this.pulseSamples = lanesForPulse;
    this.pulsePositions = new Float32Array(LANES.length * 2 * 3);
    this.pulseGeometry = new BufferGeometry();
    this.pulseGeometry.setAttribute(
      "position",
      new BufferAttribute(this.pulsePositions, 3),
    );

    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 64;
    textureCanvas.height = 64;
    const context = textureCanvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(190,245,255,0.85)");
      gradient.addColorStop(1, "rgba(127,231,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
    this.pulseTexture = new CanvasTexture(textureCanvas);
    this.pulseTexture.needsUpdate = true;

    this.pulseMaterial = new PointsMaterial({
      color: "#c9f7ff",
      size: 0.26,
      map: this.pulseTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });

    const pulses = new Points(this.pulseGeometry, this.pulseMaterial);
    pulses.frustumCulled = false;
    pulses.renderOrder = 5;

    this.group.add(lines, halo, ports, pulses);
    this.group.visible = false;
  }

  setActive(index: number): void {
    this.active = Math.min(2, Math.max(0, Math.round(index)));
    this.focusTarget = 1;
  }

  update(time: number, weight: number, delta = 0): void {
    this.focus =
      delta > 0
        ? MathUtils.damp(this.focus, this.focusTarget, 6, delta)
        : this.focusTarget;

    this.material.uniforms.uActive.value = this.active;
    this.material.uniforms.uFocus.value = this.focus;

    const visible = weight > 0.004;

    this.group.visible = visible;
    if (!visible) return;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uReveal.value = Math.min(1, weight * 1.4);
    this.material.uniforms.uIntensity.value = 1.35;
    this.portMaterial.opacity = Math.min(1, weight * 1.2);
    this.pulseMaterial.opacity = Math.min(1, weight * 1.3);

    const count = this.pulseSamples.length;

    for (let lane = 0; lane < count; lane += 1) {
      const samples = this.pulseSamples[lane];

      for (let head = 0; head < 2; head += 1) {
        const t = (time * 0.075 + lane * 0.29 + head * 0.5) % 1;
        const scaled = t * (samples.length - 1);
        const index = Math.floor(scaled);
        const next = Math.min(samples.length - 1, index + 1);
        const mix = scaled - index;
        const a = samples[index];
        const b = samples[next];
        const offset = (lane * 2 + head) * 3;

        this.pulsePositions[offset] = a.x + (b.x - a.x) * mix;
        this.pulsePositions[offset + 1] = a.y + (b.y - a.y) * mix;
        this.pulsePositions[offset + 2] = a.z + (b.z - a.z) * mix;
      }
    }

    this.pulseGeometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.portGeometry.dispose();
    this.portMaterial.dispose();
    this.pulseGeometry.dispose();
    this.pulseMaterial.dispose();
    this.pulseTexture.dispose();
  }
}
