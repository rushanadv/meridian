/**
 * GLSL for the Meridian hero.
 * Scene shaders output linear color: the composer's OutputPass applies tone
 * mapping and sRGB conversion once, at the end of the chain.
 */

export const globeVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAssemble;
  uniform float uScale;

  attribute float aSize;
  attribute vec3 aColor;
  attribute vec3 aScatter;
  attribute float aSeed;
  attribute float aLand;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float t = clamp(uAssemble, 0.0, 1.0);
    float eased = t * t * (3.0 - 2.0 * t);

    vec3 pos = mix(aScatter, position, eased);
    pos += normalize(position) * sin(uTime * 0.65 + aSeed * 6.28318) * 0.004 * aLand;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    vec3 outward = normalize(mat3(modelMatrix) * normalize(position));
    float facing = dot(outward, normalize(cameraPosition - world.xyz));
    float front = smoothstep(-0.38, 0.72, facing);

    vColor = aColor * mix(0.55, 1.0, front);
    vAlpha = mix(0.10, 0.58, aLand) * mix(0.22, 1.0, front);

    gl_PointSize = aSize * uScale / max(0.25, -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const globeFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    if (d2 > 0.25) discard;

    float d = sqrt(d2);
    float alpha = 1.0 - smoothstep(0.06, 0.5, d);
    gl_FragColor = vec4(vColor, vAlpha * alpha);
  }
`;

export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const atmosphereFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;

  varying vec3 vNormalW;
  varying vec3 vViewW;

  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), 2.6);
    gl_FragColor = vec4(uColor, rim * uIntensity);
  }
`;

export const streamlineVertexShader = /* glsl */ `
  attribute float aArc;
  attribute float aSeed;
  attribute float aSpeed;

  varying float vArc;
  varying float vSeed;
  varying float vSpeed;

  void main() {
    vArc = aArc;
    vSeed = aSeed;
    vSpeed = aSpeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const streamlineFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;

  varying float vArc;
  varying float vSeed;
  varying float vSpeed;

  void main() {
    float head = fract(uTime * vSpeed + vSeed);
    float d = abs(vArc - head);
    d = min(d, 1.0 - d);

    float pulse = 1.0 - smoothstep(0.0, 0.055, d);
    float alpha = (0.026 + pulse * 0.85) * uOpacity;

    vec3 base = vec3(0.16, 0.34, 0.40);
    vec3 hot = vec3(0.50, 0.91, 1.0);
    vec3 color = mix(base, hot, pulse);

    gl_FragColor = vec4(color, alpha);
  }
`;

export const starVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;

  attribute float aSize;
  attribute float aSeed;

  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(0.5, -mvPosition.z);
    vAlpha = 0.28 + 0.32 * sin(uTime * 0.35 + aSeed * 6.28318);
  }
`;

export const starFragmentShader = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    float d = sqrt(dot(c, c));
    float alpha = (1.0 - smoothstep(0.0, 0.5, d)) * vAlpha;
    gl_FragColor = vec4(vec3(0.42, 0.55, 0.65), alpha);
  }
`;

import { Vector2 } from "three";

export const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uAberration: { value: 0.0034 },
    uGrain: { value: 0.028 },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uAberration;
    uniform float uGrain;
    uniform float uVignette;

    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float radial = length(dir);

      vec2 offset = dir * uAberration * (0.35 + radial);
      float r = texture2D(tDiffuse, uv + offset).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - offset).b;

      vec3 color = vec3(r, g, b);
      float grain = (hash12(uv * uResolution + fract(uTime) * 97.0) - 0.5) * uGrain;
      color += grain;

      float vig = 1.0 - smoothstep(0.30, 0.78, radial);
      color *= mix(1.0, vig, uVignette);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
