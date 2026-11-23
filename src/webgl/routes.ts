import * as THREE from "three";
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

const toVector = (port: Port): THREE.Vector3 => {
  const lat = port.lat * DEG;
  const lon = port.lon * DEG;
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    Math.cos(lat) * Math.sin(lon),
  );
};

export class Routes {
  readonly group = new THREE.Group();

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly portGeometry: THREE.BufferGeometry;
  private readonly portMaterial: THREE.PointsMaterial;
  private readonly pulseGeometry: THREE.BufferGeometry;
  private readonly pulseMaterial: THREE.PointsMaterial;
  private readonly pulsePositions: Float32Array;
  private readonly pulseSamples: THREE.Vector3[][];
  private readonly pulseTexture: THREE.CanvasTexture;

  constructor() {
    const positions: number[] = [];
    const progresses: number[] = [];
    const routes: number[] = [];
    const seeds: number[] = [];
    const steps = 110;
    const lanesForPulse: THREE.Vector3[][] = [];

    LANES.forEach((lane, routeIndex) => {
      const start = toVector(lane.from);
      const end = toVector(lane.to);
      const seed = 0.17 + routeIndex * 0.31;

      const samples: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        const t = i / 64;
        const dir = start
          .clone()
          .multiplyScalar(1 - t)
          .addScaledVector(end, t)
          .normalize();
        const radius = RADIUS + 0.06 + Math.sin(Math.PI * t) * 0.22;
        samples.push(new THREE.Vector3(dir.x * radius, dir.y * radius, dir.z * radius));
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

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "aProgress",
      new THREE.Float32BufferAttribute(progresses, 1),
    );
    this.geometry.setAttribute(
      "aRoute",
      new THREE.Float32BufferAttribute(routes, 1),
    );
    this.geometry.setAttribute(
      "aSeed",
      new THREE.Float32BufferAttribute(seeds, 1),
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uIntensity: { value: 0 },
      },
      vertexShader: routeVertexShader,
      fragmentShader: routeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const lines = new THREE.LineSegments(this.geometry, this.material);
    lines.frustumCulled = false;
    lines.renderOrder = 3;

    const portPositions: number[] = [];

    LANES.forEach((lane) => {
      for (const port of [lane.from, lane.to]) {
        const dir = toVector(port);
        const radius = RADIUS + 0.06;
        portPositions.push(dir.x * radius, dir.y * radius, dir.z * radius);
      }
    });

    this.portGeometry = new THREE.BufferGeometry();
    this.portGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(portPositions, 3),
    );

    this.portMaterial = new THREE.PointsMaterial({
      color: "#7fe7ff",
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const ports = new THREE.Points(this.portGeometry, this.portMaterial);
    ports.frustumCulled = false;
    ports.renderOrder = 4;

    this.pulseSamples = lanesForPulse;
    this.pulsePositions = new Float32Array(LANES.length * 2 * 3);
    this.pulseGeometry = new THREE.BufferGeometry();
    this.pulseGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.pulsePositions, 3),
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
    this.pulseTexture = new THREE.CanvasTexture(textureCanvas);
    this.pulseTexture.needsUpdate = true;

    this.pulseMaterial = new THREE.PointsMaterial({
      color: "#c9f7ff",
      size: 0.12,
      map: this.pulseTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const pulses = new THREE.Points(this.pulseGeometry, this.pulseMaterial);
    pulses.frustumCulled = false;
    pulses.renderOrder = 5;

    this.group.add(lines, ports, pulses);
    this.group.visible = false;
  }

  update(time: number, weight: number): void {
    const visible = weight > 0.004;

    this.group.visible = visible;
    if (!visible) return;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uReveal.value = Math.min(1, weight * 1.4);
    this.material.uniforms.uIntensity.value = 1.25;
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
