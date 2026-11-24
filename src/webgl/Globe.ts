import {
  AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, Group,
  LineBasicMaterial, LineSegments, MathUtils, Mesh, Points, ShaderMaterial,
  SphereGeometry, Vector3,
} from "three";
import { isCoarsePointer } from "../lib/motion";
import { ENSEMBLE_ORIGIN } from "./ensemble";
import { fbm3, maskAt, sampleLand } from "./landmask";
import {
  atmosphereFragmentShader,
  atmosphereVertexShader,
  globeFragmentShader,
  globeVertexShader,
  starFragmentShader,
  starVertexShader,
  streamlineFragmentShader,
  streamlineVertexShader,
} from "./shaders";

const RADIUS = 2;
const DEG = Math.PI / 180;
const HERO_YAW =
  ENSEMBLE_ORIGIN.lon * DEG - Math.PI / 2 - 0.55;

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

export class Globe {
  readonly root = new Group();
  readonly group = new Group();

  private readonly pointsMaterial: ShaderMaterial;
  private readonly streamMaterial: ShaderMaterial;
  private readonly starMaterial: ShaderMaterial;
  private readonly pointsGeometry: BufferGeometry;
  private readonly streamGeometry: BufferGeometry;
  private readonly starGeometry: BufferGeometry;
  private readonly graticuleMaterial: LineBasicMaterial;
  private readonly graticuleGeometry: BufferGeometry;
  private readonly equatorMaterial: LineBasicMaterial;
  private readonly equatorGeometry: BufferGeometry;
  private readonly atmosphereGeometry: SphereGeometry;
  private readonly atmosphereMaterial: ShaderMaterial;

  private readonly baseYaw = HERO_YAW;
  private spin = 0;
  private yaw = HERO_YAW;
  private pitch = -0.08;

  constructor() {
    const random = seededRandom(20260214);

    this.pointsGeometry = new BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const scatters: number[] = [];
    const seeds: number[] = [];
    const lands: number[] = [];

    const landBase = new Color("#f2eee6");
    const landHigh = new Color("#7fe7ff");
    const oceanBase = new Color("#1d4354");

    const step = isCoarsePointer ? 1.25 : 0.8;
    const rows = Math.round(180 / step);

    for (let row = 1; row < rows; row += 1) {
      const lat = -90 + row * step;
      const latRad = lat * DEG;
      const cosLat = Math.cos(latRad);
      const lonCount = Math.max(10, Math.round((360 / step) * Math.max(cosLat, 0.06)));

      for (let column = 0; column < lonCount; column += 1) {
        const lon = -180 + (column / lonCount) * 360;
        const lonRad = lon * DEG;

        const x = cosLat * Math.cos(lonRad);
        const y = Math.sin(latRad);
        const z = cosLat * Math.sin(lonRad);

        const sample = sampleLand(x, y, z);
        const land = maskAt(lat, lon) > 0.5;

        if (!land && column % 3 !== 0) continue;

        const elevation = MathUtils.clamp((sample.elevation - 0.28) / 0.33, 0, 1);

        positions.push(x * RADIUS, y * RADIUS, z * RADIUS);

        const color = land
          ? landBase.clone().lerp(landHigh, 0.06 + elevation * 0.4)
          : oceanBase.clone().lerp(landHigh, 0.04 + elevation * 0.12);

        colors.push(color.r, color.g, color.b);

        sizes.push(
          land
            ? 0.033 + elevation * 0.026 + random() * 0.009
            : 0.014 + random() * 0.012,
        );

        const scatterDir = new Vector3(
          random() * 2 - 1,
          random() * 2 - 1,
          random() * 2 - 1,
        ).normalize();
        const scatterDistance = 3.4 + random() * 7.2;
        scatters.push(
          scatterDir.x * scatterDistance + (random() - 0.5) * 2,
          scatterDir.y * scatterDistance + (random() - 0.5) * 2,
          scatterDir.z * scatterDistance + (random() - 0.5) * 2,
        );

        seeds.push(random());
        lands.push(land ? 1 : 0);
      }
    }

    this.pointsGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.pointsGeometry.setAttribute(
      "aColor",
      new Float32BufferAttribute(colors, 3),
    );
    this.pointsGeometry.setAttribute(
      "aSize",
      new Float32BufferAttribute(sizes, 1),
    );
    this.pointsGeometry.setAttribute(
      "aScatter",
      new Float32BufferAttribute(scatters, 3),
    );
    this.pointsGeometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(seeds, 1),
    );
    this.pointsGeometry.setAttribute(
      "aLand",
      new Float32BufferAttribute(lands, 1),
    );

    this.pointsMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uAssemble: { value: 0 },
        uScale: { value: 1 },
        uStormDir: { value: new Vector3(0, 1, 0) },
        uStormAmp: { value: 0 },
        uDim: { value: 1 },
      },
      vertexShader: globeVertexShader,
      fragmentShader: globeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const points = new Points(this.pointsGeometry, this.pointsMaterial);
    points.frustumCulled = false;
    points.renderOrder = 1;

    this.atmosphereGeometry = new SphereGeometry(RADIUS * 1.055, 48, 32);
    this.atmosphereMaterial = new ShaderMaterial({
      uniforms: {
        uColor: { value: new Color("#7fe7ff") },
        uIntensity: { value: 0.34 },
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      depthWrite: false,
      side: BackSide,
      blending: AdditiveBlending,
    });

    const atmosphere = new Mesh(
      this.atmosphereGeometry,
      this.atmosphereMaterial,
    );
    atmosphere.renderOrder = 0;

    this.graticuleGeometry = new BufferGeometry();
    const graticulePositions: number[] = [];
    const pushArc = (
      axis: "lat" | "lon",
      fixed: number,
      count: number,
    ) => {
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        const b = ((i + 1) / count) * Math.PI * 2;
        const radius = RADIUS * 0.9985;

        let ax: number;
        let ay: number;
        let az: number;
        let bx: number;
        let by: number;
        let bz: number;

        if (axis === "lat") {
          const r = radius * Math.cos(fixed * DEG);
          const y = radius * Math.sin(fixed * DEG);
          ax = r * Math.cos(a);
          ay = y;
          az = r * Math.sin(a);
          bx = r * Math.cos(b);
          by = y;
          bz = r * Math.sin(b);
        } else {
          ax = radius * Math.cos(a);
          ay = radius * Math.sin(a);
          az = 0;
          bx = radius * Math.cos(b);
          by = radius * Math.sin(b);
          bz = 0;

          const rot = fixed * DEG;
          const cos = Math.cos(rot);
          const sin = Math.sin(rot);
          const tax = ax;
          const taz = az;
          ax = tax * cos - taz * sin;
          az = tax * sin + taz * cos;
          const tbx = bx;
          const tbz = bz;
          bx = tbx * cos - tbz * sin;
          bz = tbx * sin + tbz * cos;
        }

        graticulePositions.push(ax, ay, az, bx, by, bz);
      }
    };

    for (const lat of [-60, -30, 30, 60]) pushArc("lat", lat, 72);
    for (const lon of [0, 30, 60, 90, 120, 150]) pushArc("lon", lon, 72);

    this.graticuleGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(graticulePositions, 3),
    );
    this.graticuleMaterial = new LineBasicMaterial({
      color: "#7fe7ff",
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
    });
    const graticule = new LineSegments(
      this.graticuleGeometry,
      this.graticuleMaterial,
    );

    this.equatorGeometry = new BufferGeometry();
    const equatorPositions: number[] = [];
    pushArc("lat", 0, 128);
    for (const value of graticulePositions.slice(-128 * 6)) {
      equatorPositions.push(value);
    }
    this.equatorGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(equatorPositions, 3),
    );
    this.equatorMaterial = new LineBasicMaterial({
      color: "#7fe7ff",
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const equator = new LineSegments(
      this.equatorGeometry,
      this.equatorMaterial,
    );

    this.streamGeometry = new BufferGeometry();
    const streamPositions: number[] = [];
    const arcs: number[] = [];
    const streamSeeds: number[] = [];
    const speeds: number[] = [];
    const streamCount = isCoarsePointer ? 82 : 154;
    const steps = 28;

    const field = (x: number, y: number, z: number) =>
      fbm3(x * 3.1 + 12.4, y * 3.1 + 4.6, z * 3.1 + 8.2, 4);

    for (let s = 0; s < streamCount; s += 1) {
      // Even seed distribution on the sphere.
      const phi = Math.acos(1 - (2 * (s + 0.5)) / streamCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * s;
      const dir = new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta),
      );

      const direction = s % 2 === 0 ? 1 : -1;
      const seed = random();
      const speed = 0.45 + random() * 0.8;

      for (let i = 0; i < steps; i += 1) {
        const eps = 0.18;
        const gx =
          field(dir.x + eps, dir.y, dir.z) -
          field(dir.x - eps, dir.y, dir.z);
        const gy =
          field(dir.x, dir.y + eps, dir.z) -
          field(dir.x, dir.y - eps, dir.z);
        const gz =
          field(dir.x, dir.y, dir.z + eps) -
          field(dir.x, dir.y, dir.z - eps);

        const tangent = new Vector3(gx, gy, gz);
        tangent.cross(dir).multiplyScalar(direction);
        tangent.addScaledVector(
          new Vector3(-dir.z, 0, dir.x),
          0.55 * direction,
        );
        tangent.projectOnPlane(dir);

        if (tangent.lengthSq() < 0.0001) {
          tangent.set(-dir.z, 0, dir.x);
        }
        tangent.normalize();

        const next = dir.clone().addScaledVector(tangent, 0.042).normalize();
        const r = RADIUS * 1.014;

        streamPositions.push(
          dir.x * r,
          dir.y * r,
          dir.z * r,
          next.x * r,
          next.y * r,
          next.z * r,
        );

        const startArc = i / steps;
        const endArc = (i + 1) / steps;
        arcs.push(startArc, endArc);
        streamSeeds.push(seed, seed);
        speeds.push(speed, speed);

        dir.copy(next);
      }
    }

    this.streamGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(streamPositions, 3),
    );
    this.streamGeometry.setAttribute(
      "aArc",
      new Float32BufferAttribute(arcs, 1),
    );
    this.streamGeometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(streamSeeds, 1),
    );
    this.streamGeometry.setAttribute(
      "aSpeed",
      new Float32BufferAttribute(speeds, 1),
    );

    this.streamMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0.9 },
      },
      vertexShader: streamlineVertexShader,
      fragmentShader: streamlineFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const streams = new LineSegments(
      this.streamGeometry,
      this.streamMaterial,
    );
    streams.renderOrder = 2;

    this.starGeometry = new BufferGeometry();
    const starPositions: number[] = [];
    const starSizes: number[] = [];
    const starSeeds: number[] = [];
    const starCount = isCoarsePointer ? 340 : 760;

    for (let i = 0; i < starCount; i += 1) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / starCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * (i + 3);
      const distance = 26 + random() * 30;
      starPositions.push(
        Math.sin(phi) * Math.cos(theta) * distance,
        Math.cos(phi) * distance,
        Math.sin(phi) * Math.sin(theta) * distance,
      );
      starSizes.push(0.018 + random() * 0.05);
      starSeeds.push(random());
    }

    this.starGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(starPositions, 3),
    );
    this.starGeometry.setAttribute(
      "aSize",
      new Float32BufferAttribute(starSizes, 1),
    );
    this.starGeometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(starSeeds, 1),
    );

    this.starMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 1 },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const stars = new Points(this.starGeometry, this.starMaterial);
    stars.frustumCulled = false;
    stars.renderOrder = -1;

    this.group.add(
      points,
      atmosphere,
      graticule,
      equator,
      streams,
    );
    this.group.rotation.z = 0.13;

    this.root.add(this.group, stars);
  }

  setAssemble(value: number): void {
    this.pointsMaterial.uniforms.uAssemble.value = value;
  }

  setStorm(
    direction: Vector3,
    amplitude: number,
    dim: number,
  ): void {
    this.pointsMaterial.uniforms.uStormDir.value.copy(direction);
    this.pointsMaterial.uniforms.uStormAmp.value = amplitude;
    this.pointsMaterial.uniforms.uDim.value = dim;
  }

  /**
   * Fades the planet's surface, atmosphere, graticule and wind streaks
   * without touching the star field. Used when editorial sections need
   * a quiet backdrop after the lane view.
   */
  setVeil(value: number): void {
    const veil = MathUtils.clamp(value, 0, 1);

    this.atmosphereMaterial.uniforms.uIntensity.value = 0.34 * (1 - veil);
    this.graticuleMaterial.opacity = 0.055 * (1 - veil);
    this.equatorMaterial.opacity = 0.16 * (1 - veil);
    this.streamMaterial.uniforms.uOpacity.value = 0.9 * (1 - veil);
  }

  resize(heightCss: number, pixelRatio: number): void {
    const scale = (heightCss * pixelRatio) / 2;
    this.pointsMaterial.uniforms.uScale.value = scale;
    this.starMaterial.uniforms.uScale.value = scale;
  }

  update(
    time: number,
    delta: number,
    pointer: { x: number; y: number },
    storm: number,
    reduced: boolean,
  ): void {
    this.pointsMaterial.uniforms.uTime.value = time;
    this.streamMaterial.uniforms.uTime.value = time;
    this.starMaterial.uniforms.uTime.value = time;

    if (reduced) {
      this.group.rotation.y = this.yaw;
      this.group.rotation.x = this.pitch;
      return;
    }

    this.spin += delta * 0.045 * (1 - storm * 0.75);

    const calm = 1 - storm * 0.55;
    const targetYaw =
      this.baseYaw + this.spin + pointer.x * 0.34 * calm + storm * 0.05;
    const targetPitch = -0.08 + pointer.y * 0.22 * calm - storm * 0.04;

    this.yaw = MathUtils.damp(this.yaw, targetYaw, 3.2, delta);
    this.pitch = MathUtils.damp(this.pitch, targetPitch, 3.0, delta);

    this.group.rotation.y = this.yaw;
    this.group.rotation.x = this.pitch;
  }

  getWorldCenter(target: Vector3): Vector3 {
    return this.group.getWorldPosition(target);
  }

  dispose(): void {
    this.pointsGeometry.dispose();
    this.pointsMaterial.dispose();
    this.atmosphereGeometry.dispose();
    this.atmosphereMaterial.dispose();
    this.graticuleGeometry.dispose();
    this.graticuleMaterial.dispose();
    this.equatorGeometry.dispose();
    this.equatorMaterial.dispose();
    this.streamGeometry.dispose();
    this.streamMaterial.dispose();
    this.starGeometry.dispose();
    this.starMaterial.dispose();
  }
}
