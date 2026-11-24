import {
  Mesh, PlaneGeometry, ShaderMaterial, Vector2,
} from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWeight;
  uniform float uHover;
  uniform float uAspect;
  uniform vec2 uPointer;

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

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    float t = uTime * 0.055;
    vec2 pointerUv = uPointer * 0.5 + 0.5;
    vec2 delta = (vUv - pointerUv) * vec2(uAspect, 1.0);
    float lens = exp(-dot(delta, delta) * 5.2) * uHover;

    vec2 warped = vUv
      + normalize(vUv - pointerUv + 0.0001) * lens * 0.095;
    vec2 drift = vec2(t * 1.2, -t * 0.75);

    float broad = fbm(warped * vec2(2.4 * uAspect, 2.4) + drift);
    float detail = fbm(warped * 5.6 - drift * 0.6 + 11.0);
    float band = smoothstep(0.36, 0.88, broad) * 0.18 + detail * 0.055;

    vec3 deep = vec3(0.012, 0.035, 0.045);
    vec3 cool = vec3(0.02, 0.16, 0.19);
    vec3 rim = vec3(0.25, 0.85, 0.95);

    vec3 color = mix(deep, cool, band * 3.0 + lens * 0.35);
    float rimGlow = pow(max(0.0, detail - 0.55), 2.0) * (0.35 + lens * 1.2);
    color += rim * rimGlow * 0.42;
    color *= 0.82 + 0.18 * sin(vUv.y * 3.0 + t);

    float alpha = (0.16 + band * 0.92 + lens * 0.15) * uWeight;

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.66));
  }
`;

export class PricingField {
  readonly root: Mesh;

  private readonly geometry: PlaneGeometry;
  private readonly material: ShaderMaterial;

  constructor() {
    this.geometry = new PlaneGeometry(2, 2);

    this.material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWeight: { value: 0 },
        uHover: { value: 0 },
        uAspect: { value: 1 },
        uPointer: { value: new Vector2(0.5, 0.5) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    this.root = new Mesh(this.geometry, this.material);
    this.root.frustumCulled = false;
    this.root.renderOrder = -100;
    this.root.visible = false;
  }

  update(
    time: number,
    weight: number,
    hover: number,
    pointer: Vector2,
    aspect: number,
  ): void {
    this.root.visible = weight > 0.01;
    if (!this.root.visible) return;

    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWeight.value = weight;
    this.material.uniforms.uHover.value = hover;
    this.material.uniforms.uAspect.value = aspect;
    this.material.uniforms.uPointer.value.copy(pointer);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
