/**
 * GLSL for Meridian.
 * Scene shaders output linear color: the composer's OutputPass applies tone
 * mapping and sRGB conversion once, at the end of the chain.
 */

import { Vector2 } from "three";

export const globeVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAssemble;
  uniform float uScale;
  uniform vec3 uStormDir;
  uniform float uStormAmp;
  uniform float uDim;

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

    vec3 npos = normalize(position);

    vec3 pos = mix(aScatter, position, eased);
    pos += npos * sin(uTime * 0.65 + aSeed * 6.28318) * 0.004 * aLand;

    float angle = acos(clamp(dot(npos, normalize(uStormDir)), -1.0, 1.0));
    float ripple = sin(angle * 20.0 - uTime * 2.6) * exp(-angle * 3.4);
    float swirl = ripple * uStormAmp * eased;

    pos += npos * swirl * 0.055;
    pos += normalize(cross(npos, vec3(0.0, 1.0, 0.0))) * swirl * 0.03;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    vec3 outward = normalize(mat3(modelMatrix) * normalize(position));
    float facing = dot(outward, normalize(cameraPosition - world.xyz));
    float front = smoothstep(-0.38, 0.72, facing);

    vColor = aColor * mix(0.55, 1.0, front);
    vAlpha = mix(0.10, 0.58, aLand) * mix(0.22, 1.0, front) * uDim;

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

export const stormVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uIntensity;
  uniform float uHover;
  uniform vec2 uPointer;

  attribute float aRadius;
  attribute float aAngle;
  attribute float aSeed;
  attribute float aSize;

  varying float vHeat;
  varying float vAlpha;

  void main() {
    float r = aRadius;
    float ang = aAngle
      + uTime * (0.16 + 0.52 / (r + 0.3))
      + sin(uTime * 0.6 + aSeed * 6.28318) * 0.06;
    float lift = sin(aSeed * 9.0 + r * 9.0 - uTime * 1.3) * 0.03 * (1.0 - r * 0.55);

    vec3 pos = vec3(cos(ang) * r, lift, sin(ang) * r);

    vec2 delta = pos.xz - uPointer;
    float dist = length(delta);
    float push = uHover * 0.24 * exp(-dist * dist * 5.0);
    pos.xz += normalize(delta + vec2(0.0001)) * push;
    pos.y += push * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float atten = uScale / max(0.35, -mvPosition.z);
    gl_PointSize = aSize * atten * (1.0 + uHover * 0.4);

    vHeat = smoothstep(0.66, 0.08, r);
    vAlpha = uIntensity
      * (0.14 + 0.8 * smoothstep(0.0, 0.14, r))
      * (0.5 + 0.5 * aSeed);
  }
`;

export const stormFragmentShader = /* glsl */ `
  varying float vHeat;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    if (d2 > 0.25) discard;

    float d = sqrt(d2);
    float alpha = 1.0 - smoothstep(0.04, 0.5, d);

    vec3 cool = vec3(0.2, 0.55, 0.66);
    vec3 hot = vec3(0.82, 0.97, 1.0);
    vec3 color = mix(cool, hot, vHeat);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`;

export const routeVertexShader = /* glsl */ `
  attribute float aProgress;
  attribute float aRoute;
  attribute float aSeed;

  varying float vProgress;
  varying float vRoute;
  varying float vSeed;

  void main() {
    vProgress = aProgress;
    vRoute = aRoute;
    vSeed = aSeed;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const routeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uIntensity;
  uniform float uActive;
  uniform float uFocus;

  varying float vProgress;
  varying float vRoute;
  varying float vSeed;

  float head(float phase) {
    float h = fract(uTime * 0.11 + phase);
    float d = abs(vProgress - h);
    d = min(d, 1.0 - d);
    return 1.0 - smoothstep(0.0, 0.045, d);
  }

  void main() {
    float draw = smoothstep(0.0, 0.06, uReveal - vProgress * 0.92 + 0.06);
    float dash = smoothstep(0.32, 0.5, abs(fract(vProgress * 44.0) - 0.5));

    float pulse = head(vRoute * 0.33 + vSeed) * 1.3
      + head(vRoute * 0.33 + vSeed + 0.5) * 1.0;

    float isActive = 1.0 - step(0.5, abs(vRoute - uActive));
    float laneGain = mix(1.0, mix(0.42, 1.7, isActive), uFocus);

    vec3 baseCol = vec3(0.46, 0.9, 1.0);
    vec3 hotCol = vec3(0.88, 1.0, 1.0);
    vec3 color = mix(baseCol, hotCol, clamp(pulse + isActive * uFocus * 0.35, 0.0, 1.0));

    gl_FragColor = vec4(
      color,
      (0.4 + dash * 0.26 + pulse) * draw * uIntensity * laneGain
    );
  }
`;

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
