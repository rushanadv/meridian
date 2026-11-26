import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture,
  Float32BufferAttribute, Group, LineSegments, MathUtils, Points, PointsMaterial,
  ShaderMaterial, Vector3,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { routeFragmentShader, routeVertexShader } from "./shaders";

const DEG = Math.PI / 180;
const RADIUS = 2;
const LIFT = 0.06;
const MEMBERS = 51;
const REALISED = 17;
const TRACK_SEGMENTS = 48;

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

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const lanePoint = (
  start: Vector3,
  end: Vector3,
  t: number,
  radius: number,
): Vector3 => {
  const dir = start
    .clone()
    .multiplyScalar(1 - t)
    .addScaledVector(end, t)
    .normalize();
  return dir.multiplyScalar(radius);
};

/** A stable pseudo-random in [0,1) so member ribbons do not shimmer. */
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

interface LaneLine {
  line: Line2;
  material: LineMaterial;
  geometry: LineGeometry;
}

const makeLine = (
  points: Vector3[],
  options: {
    color: number;
    width: number;
    dashed?: boolean;
    opacity?: number;
  },
): LaneLine => {
  const geometry = new LineGeometry();
  const flat: number[] = [];
  for (const point of points) flat.push(point.x, point.y, point.z);
  geometry.setPositions(flat);

  const material = new LineMaterial({
    color: options.color,
    linewidth: options.width,
    transparent: true,
    opacity: options.opacity ?? 0,
    depthWrite: false,
    blending: AdditiveBlending,
    dashed: options.dashed ?? false,
    dashSize: 0.22,
    gapSize: 0.12,
    dashScale: 1,
  });
  material.resolution.set(1, 1);

  const line = new Line2(geometry, material);
  line.computeLineDistances();
  line.frustumCulled = false;
  line.renderOrder = 4;
  line.visible = false;

  return { line, material, geometry };
};

/**
 * The lane instrument. One continuous 51-member draw call crosses the active
 * lane; thick Line2 overlays carry the realised member, the dashed ghost of
 * the old passage and the drawn-on detour around the storm. Comets ride the
 * lane arcs so the field reads as live even at rest.
 */
export class Routes {
  readonly group = new Group();

  private readonly bundle: LineSegments;
  private readonly bundleMaterial: ShaderMaterial;
  private readonly bundleGeometry: BufferGeometry;

  private readonly arcs: LaneLine[] = [];
  private readonly oldPaths: LaneLine[] = [];
  private readonly newPaths: LaneLine[] = [];
  private readonly realisedPaths: LaneLine[] = [];

  private readonly portGeometry: BufferGeometry;
  private readonly portMaterial: PointsMaterial;
  private readonly pulseGeometry: BufferGeometry;
  private readonly pulseMaterial: PointsMaterial;
  private readonly pulsePositions: Float32Array;
  private readonly pulseSamples: Vector3[][];
  private readonly pulseTexture: CanvasTexture;

  private readonly materials: LineMaterial[] = [];

  private active = 0;
  private focus = 0;
  private focusTarget = 1;
  private replayStart = -1;
  private replayPending = false;

  constructor() {
    const positions: number[] = [];
    const progresses: number[] = [];
    const routes: number[] = [];
    const members: number[] = [];
    const seeds: number[] = [];
    const lanesForPulse: Vector3[][] = [];

    LANES.forEach((lane, routeIndex) => {
      const start = toVector(lane.from);
      const end = toVector(lane.to);

      const base = (t: number) =>
        lanePoint(start, end, t, RADIUS + LIFT + Math.sin(Math.PI * t) * 0.22);

      const baseSamples: Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        baseSamples.push(base(i / 64));
      }
      lanesForPulse.push(baseSamples);

      // 51 member ribbons: a fan across the lane with member 17 on the spine.
      for (let member = 0; member < MEMBERS; member += 1) {
        const rank = (member - REALISED) / REALISED;
        const seed = hash(routeIndex + 1, member + 1);

        for (let i = 0; i < TRACK_SEGMENTS; i += 1) {
          const t0 = i / TRACK_SEGMENTS;
          const t1 = (i + 1) / TRACK_SEGMENTS;

          for (const t of [t0, t1]) {
            const spine = base(t);
            const ahead = base(Math.min(1, t + 0.01));
            const behind = base(Math.max(0, t - 0.01));
            const tangent = ahead.clone().sub(behind).normalize();
            const normal = spine.clone().normalize();
            const side = new Vector3()
              .crossVectors(tangent, normal)
              .normalize();

            const ribbon =
              (rank * 0.13 + (rank === 0 ? 0 : (seed - 0.5) * 0.03)) *
              Math.sin(Math.PI * t);
            const point = spine.addScaledVector(side, ribbon);

            positions.push(point.x, point.y, point.z);
            progresses.push(t);
            routes.push(routeIndex);
            members.push(member);
            seeds.push(seed);
          }
        }
      }

      const realised = baseSamples.map((point) => {
        const tangent = point.clone().normalize();
        return point.clone().addScaledVector(tangent, 0.006);
      });

      const detour = (t: number) => {
        const spine = base(t);
        const radius = spine.length();
        const ahead = base(Math.min(1, t + 0.01));
        const behind = base(Math.max(0, t - 0.01));
        const tangent = ahead.clone().sub(behind).normalize();
        const normal = spine.clone().normalize();
        const side = new Vector3().crossVectors(tangent, normal).normalize();
        const bump = Math.exp(-Math.pow((t - 0.54) / 0.21, 2)) * 0.16;
        return spine
          .addScaledVector(side, -bump)
          .normalize()
          .multiplyScalar(radius);
      };

      const detourSamples: Vector3[] = [];
      for (let i = 0; i <= 64; i += 1) {
        detourSamples.push(detour(i / 64));
      }

      this.arcs.push(
        makeLine(baseSamples, { color: 0x7fe7ff, width: 2.1 }),
      );
      this.realisedPaths.push(
        makeLine(realised, { color: 0xf2eee6, width: 3.1 }),
      );
      this.oldPaths.push(
        makeLine(realised, {
          color: 0xf2eee6,
          width: 2.4,
          dashed: true,
        }),
      );
      this.newPaths.push(
        makeLine(detourSamples, { color: 0xbff5ff, width: 3.4 }),
      );
    });

    this.bundleGeometry = new BufferGeometry();
    this.bundleGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.bundleGeometry.setAttribute(
      "aT",
      new Float32BufferAttribute(progresses, 1),
    );
    this.bundleGeometry.setAttribute(
      "aRoute",
      new Float32BufferAttribute(routes, 1),
    );
    this.bundleGeometry.setAttribute(
      "aMember",
      new Float32BufferAttribute(members, 1),
    );
    this.bundleGeometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(seeds, 1),
    );

    this.bundleMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uIntensity: { value: 0 },
        uActive: { value: 0 },
        uReroute: { value: 0 },
      },
      vertexShader: routeVertexShader,
      fragmentShader: routeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.bundle = new LineSegments(this.bundleGeometry, this.bundleMaterial);
    this.bundle.frustumCulled = false;
    this.bundle.renderOrder = 3;

    const portPositions: number[] = [];

    LANES.forEach((lane) => {
      for (const port of [lane.from, lane.to]) {
        const dir = toVector(port);
        const radius = RADIUS + LIFT;
        portPositions.push(dir.x * radius, dir.y * radius, dir.z * radius);
      }
    });

    this.portGeometry = new BufferGeometry();
    this.portGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(portPositions, 3),
    );

    this.portMaterial = new PointsMaterial({
      color: "#bff5ff",
      size: 0.26,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const ports = new Points(this.portGeometry, this.portMaterial);
    ports.frustumCulled = false;
    ports.renderOrder = 5;

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
      gradient.addColorStop(0.3, "rgba(210,252,255,0.95)");
      gradient.addColorStop(0.6, "rgba(127,231,255,0.5)");
      gradient.addColorStop(1, "rgba(127,231,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
    this.pulseTexture = new CanvasTexture(textureCanvas);
    this.pulseTexture.needsUpdate = true;

    this.pulseMaterial = new PointsMaterial({
      color: "#e6ffff",
      size: 0.44,
      map: this.pulseTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      sizeAttenuation: true,
    });

    const pulses = new Points(this.pulseGeometry, this.pulseMaterial);
    pulses.frustumCulled = false;
    pulses.renderOrder = 6;

    this.group.add(
      this.bundle,
      ...this.arcs.map((entry) => entry.line),
      ...this.oldPaths.map((entry) => entry.line),
      ...this.newPaths.map((entry) => entry.line),
      ...this.realisedPaths.map((entry) => entry.line),
      ports,
      pulses,
    );
    this.group.visible = false;

    for (const entry of [
      ...this.arcs,
      ...this.oldPaths,
      ...this.newPaths,
      ...this.realisedPaths,
    ]) {
      this.materials.push(entry.material);
    }
  }

  setActive(index: number): void {
    this.active = Math.min(2, Math.max(0, Math.round(index)));
    this.focusTarget = 1;
  }

  /** Re-runs the member-17 bend without touching scroll or the rest of the page. */
  playReroute(): void {
    this.replayPending = true;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const w = width * pixelRatio;
    const h = height * pixelRatio;
    for (const material of this.materials) {
      material.resolution.set(w, h);
    }
  }

  update(
    time: number,
    weight: number,
    delta = 0,
    lanes = 0,
    reroute = 0,
  ): void {
    this.focus =
      delta > 0
        ? MathUtils.damp(this.focus, this.focusTarget, 6, delta)
        : this.focusTarget;

    const reveal = smoothstep(0.16, 0.6, lanes);

    if (this.replayPending) {
      this.replayStart = time;
      this.replayPending = false;
    }

    let bend = Math.min(1, Math.max(0, reroute));
    if (this.replayStart >= 0) {
      const elapsed = time - this.replayStart;
      if (elapsed >= 1.6) {
        this.replayStart = -1;
      } else {
        bend = smoothstep(0, 1, elapsed / 1.6);
      }
    }

    this.bundleMaterial.uniforms.uTime.value = time;
    this.bundleMaterial.uniforms.uReveal.value = reveal;
    this.bundleMaterial.uniforms.uActive.value = this.active;
    this.bundleMaterial.uniforms.uReroute.value = bend;

    const visible = weight > 0.004;

    this.group.visible = visible;
    if (!visible) return;

    this.bundleMaterial.uniforms.uIntensity.value = 2.15 * weight;
    this.portMaterial.opacity = Math.min(1, weight * 1.25);
    this.pulseMaterial.opacity = Math.min(1, weight * 1.4);

    const active = this.active;
    const bendEase = smoothstep(0, 1, bend);

    for (let lane = 0; lane < LANES.length; lane += 1) {
      const isActive = lane === active;

      const arc = this.arcs[lane];
      arc.line.visible = visible;
      arc.material.opacity = weight * (isActive ? 0.98 : 0.3);

      const realised = this.realisedPaths[lane];
      realised.line.visible = visible && isActive && reveal > 0.5;
      realised.material.opacity =
        weight * (1 - bendEase) * smoothstep(0.5, 0.85, reveal);

      const ghost = this.oldPaths[lane];
      ghost.line.visible = visible && isActive && reveal > 0.5;
      ghost.material.opacity = weight * bendEase * 0.85;

      const next = this.newPaths[lane];
      next.line.visible = visible && isActive && bendEase > 0.001;
      next.material.opacity = weight * 0.95;
      const total =
        next.geometry.getAttribute("instanceStart")?.count ?? 0;
      next.geometry.instanceCount = Math.max(
        0,
        Math.round(total * bendEase),
      );
    }

    const count = this.pulseSamples.length;

    for (let lane = 0; lane < count; lane += 1) {
      const samples = this.pulseSamples[lane];

      for (let head = 0; head < 2; head += 1) {
        const t = (time * 0.085 + lane * 0.29 + head * 0.5) % 1;
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
    this.bundleGeometry.dispose();
    this.bundleMaterial.dispose();

    for (const entry of [
      ...this.arcs,
      ...this.oldPaths,
      ...this.newPaths,
      ...this.realisedPaths,
    ]) {
      entry.geometry.dispose();
      entry.material.dispose();
    }

    this.portGeometry.dispose();
    this.portMaterial.dispose();
    this.pulseGeometry.dispose();
    this.pulseMaterial.dispose();
    this.pulseTexture.dispose();
  }
}
