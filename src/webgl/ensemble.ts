import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineSegments,
  MathUtils,
  NormalBlending,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
} from "three";
import { isCoarsePointer } from "../lib/motion";
import { ensembleFragmentShader, ensembleVertexShader } from "./shaders";

const DEG = Math.PI / 180;
const RADIUS = 2;
const MEMBERS = 51;
const REALISED_MEMBER = 17;
const CONTROL_POINTS = 7;

export const ENSEMBLE_ORIGIN = { lat: 34.2, lon: -38.7 } as const;
export const ENSEMBLE_IMPACT = { lat: 10.0, lon: -80.0 } as const;

function hash(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function toDirection(lat: number, lon: number, target: Vector3): Vector3 {
  const latitude = lat * DEG;
  const longitude = lon * DEG;
  return target
    .set(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    )
    .normalize();
}

function slerpUnit(
  from: Vector3,
  to: Vector3,
  t: number,
  target: Vector3,
): Vector3 {
  const angle = Math.acos(MathUtils.clamp(from.dot(to), -1, 1));

  if (angle < 1e-5) return target.copy(from);

  const sinAngle = Math.sin(angle);
  return target
    .copy(from)
    .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
    .addScaledVector(to, Math.sin(t * angle) / sinAngle)
    .normalize();
}

function liftAt(t: number): number {
  return 0.02 + Math.sin(Math.PI * t) * 0.025;
}

function cubicSample(
  controls: Vector3[],
  t: number,
  target: Vector3,
): Vector3 {
  const last = controls.length - 1;
  const scaled = t * last;
  const segment = Math.min(last - 1, Math.floor(scaled));
  const local = scaled - segment;
  const p0 = controls[Math.max(0, segment - 1)];
  const p1 = controls[segment];
  const p2 = controls[segment + 1];
  const p3 = controls[Math.min(last, segment + 2)];
  const t2 = local * local;
  const t3 = t2 * local;

  const component = (
    a: number,
    b: number,
    c: number,
    d: number,
  ) =>
    0.5 *
    (2 * b +
      (-a + c) * local +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3);

  return target.set(
    component(p0.x, p1.x, p2.x, p3.x),
    component(p0.y, p1.y, p2.y, p3.y),
    component(p0.z, p1.z, p2.z, p3.z),
  );
}

function segmentsForViewport(): number {
  if (isCoarsePointer || window.innerWidth < 720) return 32;
  if (window.innerWidth < 1024) return 48;
  return 64;
}

export class Ensemble {
  readonly group = new Group();

  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly markerMaterial: PointsMaterial;
  private readonly markerGeometry: BufferGeometry;
  private readonly segments = segmentsForViewport();

  private targetDay = 0;
  private day = 0;
  private intro = 0;

  constructor() {
    const origin = toDirection(
      ENSEMBLE_ORIGIN.lat,
      ENSEMBLE_ORIGIN.lon,
      new Vector3(),
    );
    const impact = toDirection(
      ENSEMBLE_IMPACT.lat,
      ENSEMBLE_IMPACT.lon,
      new Vector3(),
    );

    const centerDirections: Vector3[] = [];
    for (let point = 0; point < CONTROL_POINTS; point += 1) {
      centerDirections.push(
        slerpUnit(
          origin,
          impact,
          point / (CONTROL_POINTS - 1),
          new Vector3(),
        ),
      );
    }

    const centerSamples: Vector3[] = [];
    for (let index = 0; index <= this.segments; index += 1) {
      const t = index / this.segments;
      centerSamples.push(
        slerpUnit(origin, impact, t, new Vector3()).multiplyScalar(
          RADIUS + liftAt(t),
        ),
      );
    }

    const positions: number[] = [];
    const offsets: number[] = [];
    const progresses: number[] = [];
    const colors: number[] = [];
    const weights: number[] = [];
    const seeds: number[] = [];

    const ghost = new Color("#79eaff");
    const realised = new Color("#f5f1e8");
    const frameTangent = new Vector3();
    const frameLateral = new Vector3();
    const control = new Vector3();
    const sample = new Vector3();

    for (let member = 0; member < MEMBERS; member += 1) {
      const isRealised = member === REALISED_MEMBER;
      const rank = (member / (MEMBERS - 1)) * 2 - 1;
      const fan = isRealised ? 0 : rank;
      const amplitude = isRealised
        ? 0.02
        : 0.22 + Math.abs(fan) * 0.88 + hash(member, 3) * 0.08;
      const crossAmplitude = isRealised
        ? 0.012
        : 0.08 + hash(member, 4) * 0.16;
      const seed = hash(member, 4);
      const color = isRealised ? realised : ghost;
      const weight = isRealised ? 1 : 0;

      const controls: Vector3[] = [];

      for (let point = 0; point < CONTROL_POINTS; point += 1) {
        const t = point / (CONTROL_POINTS - 1);
        const direction = centerDirections[point];
        const before =
          centerDirections[Math.max(0, point - 1)] ?? direction;
        const after =
          centerDirections[Math.min(CONTROL_POINTS - 1, point + 1)] ??
          direction;

        frameTangent.subVectors(after, before).normalize();
        frameTangent.addScaledVector(
          direction,
          -frameTangent.dot(direction),
        );

        if (frameTangent.lengthSq() < 1e-6) {
          frameTangent.set(-direction.z, 0, direction.x);
          frameTangent.addScaledVector(
            direction,
            -frameTangent.dot(direction),
          );
        }

        frameTangent.normalize();
        frameLateral.crossVectors(direction, frameTangent).normalize();

        const envelope = Math.sin(Math.PI * t);
        control
          .copy(direction)
          .multiplyScalar(RADIUS + liftAt(t))
          .addScaledVector(frameLateral, fan * amplitude * envelope)
          .addScaledVector(
            frameTangent,
            (hash(member, 2) - 0.5) * crossAmplitude * envelope * 2,
          );

        controls.push(control.clone());
      }

      const memberSamples: Vector3[] = [];
      const memberOffsets: Vector3[] = [];

      for (let index = 0; index <= this.segments; index += 1) {
        const t = index / this.segments;
        cubicSample(controls, t, sample).normalize().multiplyScalar(
          RADIUS + liftAt(t),
        );

        memberSamples.push(sample.clone());
        memberOffsets.push(
          sample.clone().sub(centerSamples[index] ?? sample),
        );
      }

      for (let index = 0; index < this.segments; index += 1) {
        for (const vertex of [index, index + 1]) {
          const base = centerSamples[vertex] ?? sample;
          const offset = memberOffsets[vertex] ?? new Vector3();

          positions.push(base.x, base.y, base.z);
          offsets.push(offset.x, offset.y, offset.z);
          progresses.push(vertex / this.segments);
          colors.push(color.r, color.g, color.b);
          weights.push(weight);
          seeds.push(seed + vertex / this.segments);
        }
      }
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute(
      "aOffset",
      new Float32BufferAttribute(offsets, 3),
    );
    this.geometry.setAttribute(
      "aProgress",
      new Float32BufferAttribute(progresses, 1),
    );
    this.geometry.setAttribute(
      "aColor",
      new Float32BufferAttribute(colors, 3),
    );
    this.geometry.setAttribute(
      "aWeight",
      new Float32BufferAttribute(weights, 1),
    );
    this.geometry.setAttribute(
      "aSeed",
      new Float32BufferAttribute(seeds, 1),
    );

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDay: { value: 0 },
        uSpread: { value: 0 },
        uLength: { value: 0 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: ensembleVertexShader,
      fragmentShader: ensembleFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });

    const tracks = new LineSegments(this.geometry, this.material);
    tracks.frustumCulled = false;
    tracks.renderOrder = 5;

    const markerPoint = impact
      .clone()
      .multiplyScalar(RADIUS + 0.05)
      .toArray();

    this.markerGeometry = new BufferGeometry();
    this.markerGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(markerPoint, 3),
    );

    this.markerMaterial = new PointsMaterial({
      color: "#f2eee6",
      size: 0.16,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const marker = new Points(this.markerGeometry, this.markerMaterial);
    marker.frustumCulled = false;
    marker.renderOrder = 6;

    this.group.add(tracks, marker);
  }

  setDay(day: number): void {
    this.targetDay = MathUtils.clamp(day, 0, 1);
  }

  setIntro(value: number): void {
    this.intro = MathUtils.clamp(value, 0, 1);
  }

  update(time: number, delta: number, reduced: boolean): void {
    this.day = reduced
      ? this.targetDay
      : MathUtils.damp(this.day, this.targetDay, 5.5, delta);

    const spread =
      Math.pow(1 - this.day, 1.2) * this.intro;
    const easedLength = 1 - Math.pow(1 - this.day, 3);
    const length = (0.55 + 0.45 * easedLength) * this.intro;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uDay.value = this.day;
    this.material.uniforms.uSpread.value = spread;
    this.material.uniforms.uLength.value = length;
    this.markerMaterial.opacity =
      this.intro * (0.42 + this.day * 0.58);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.markerGeometry.dispose();
    this.markerMaterial.dispose();
  }
}
