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
  attribute float aHeat;
  attribute float aOpacity;
  attribute float aLayer;
  attribute float aLift;

  varying float vHeat;
  varying float vAlpha;
  varying float vLayer;
  varying float vSeed;

  void main() {
    float r = aRadius;
    // Inner rings turn faster: the eye wall shears against the rain bands.
    float angularSpeed = 0.1 + 0.46 / (r + 0.3);
    float ang = aAngle
      + uTime * angularSpeed
      + sin(uTime * 0.45 + aSeed * 6.28318) * 0.05;

    // Curl-shaped turbulence bends the arms and widens the outer bands.
    float curl = sin(ang * 3.0 + aSeed * 9.0 + uTime * 0.34)
      * cos(r * 7.0 - aSeed * 4.0 - uTime * 0.26);
    float radialSway = curl * (aLayer > 1.5 ? 0.04 : aLayer > 0.5 ? 0.022 : 0.01);
    float radius = r + radialSway;
    float lift = aLift
      + sin(aSeed * 9.0 + r * 8.0 - uTime * 1.1) * 0.026 * (1.0 - clamp(r * 0.55, 0.0, 0.8));

    vec3 pos = vec3(cos(ang) * radius, lift, sin(ang) * radius);

    // Hover / tap ripple: a travelling ring plus a soft inward swell.
    vec2 delta = pos.xz - uPointer;
    float dist = length(delta);
    float ripple = sin(dist * 15.0 - uTime * 4.6)
      * exp(-dist * 2.6)
      * uHover;
    pos.xz += normalize(delta + vec2(0.0001)) * ripple * 0.055;
    pos.y += abs(ripple) * 0.05;

    float push = uHover * 0.1 * exp(-dist * dist * 4.0);
    pos.xz += normalize(delta + vec2(0.0001)) * push;
    pos.y += push * 0.24;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float atten = uScale / max(0.35, -mvPosition.z);
    float layerScale = aLayer > 1.5 ? 0.86 : aLayer > 0.5 ? 1.0 : 1.08;
    gl_PointSize = aSize * atten * layerScale * (1.0 + uHover * 0.3);

    vHeat = aHeat;
    vLayer = aLayer;
    vSeed = aSeed;
    vAlpha = uIntensity * aOpacity * (0.6 + 0.4 * aSeed);
  }
`;

export const stormFragmentShader = /* glsl */ `
  varying float vHeat;
  varying float vAlpha;
  varying float vLayer;
  varying float vSeed;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    if (d2 > 0.25) discard;

    float d = sqrt(d2);
    float point = 1.0 - smoothstep(0.02, 0.5, d);
    float glow = 1.0 - smoothstep(0.0, 0.5, d);

    vec3 rainBand = vec3(0.07, 0.26, 0.35);
    vec3 spiralArm = vec3(0.28, 0.7, 0.84);
    vec3 eyeWall = vec3(0.86, 0.98, 1.0);

    vec3 color = vLayer < 0.5
      ? eyeWall
      : vLayer < 1.5 ? spiralArm : rainBand;
    color = mix(color, vec3(0.9, 0.99, 1.0), smoothstep(0.72, 1.0, vHeat));

    float layerGain = vLayer < 0.5 ? 1.18 : vLayer < 1.5 ? 0.9 : 0.6;
    float alpha = point * vAlpha * layerGain;
    alpha += glow * vAlpha * layerGain * 0.12;

    gl_FragColor = vec4(color, alpha);
  }
`;

export const routeVertexShader = /* glsl */ `
  attribute float aT;
  attribute float aRoute;
  attribute float aMember;
  attribute float aSeed;

  varying float vT;
  varying float vRoute;
  varying float vMember;
  varying float vSeed;

  void main() {
    vT = aT;
    vRoute = aRoute;
    vMember = aMember;
    vSeed = aSeed;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const routeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uIntensity;
  uniform float uActive;
  uniform float uReroute;

  varying float vT;
  varying float vRoute;
  varying float vMember;
  varying float vSeed;

  void main() {
    // Only the selected lane resolves its 51 members; the other two lanes
    // stay as bare arcs so the selector keeps its spatial context.
    float routeOn = 1.0 - smoothstep(0.42, 0.5, abs(vRoute - uActive));
    if (routeOn < 0.01) discard;

    float isRealised = 1.0 - step(0.5, abs(vMember - 17.0));
    float draw = 1.0 - smoothstep(uReveal, uReveal + 0.05, vT);
    float head = 1.0 - smoothstep(0.0, 0.035, abs(vT - uReveal));

    // A comet runs each member so the field reads as live even at rest.
    float phase = fract(uTime * 0.09 + vSeed);
    float cometDistance = abs(vT - phase);
    cometDistance = min(cometDistance, 1.0 - cometDistance);
    float comet = 1.0 - smoothstep(0.0, 0.045, cometDistance);

    vec3 memberCol = vec3(0.4, 0.86, 0.98);
    vec3 boneCol = vec3(0.95, 0.99, 1.0);
    vec3 color = mix(memberCol, boneCol, isRealised);

    float alpha = draw * routeOn * (0.34 + comet * 0.7 + isRealised * 0.55);
    alpha += head * routeOn * 0.55;
    alpha *= 1.0 - isRealised * uReroute * 0.88;
    alpha *= uIntensity;

    gl_FragColor = vec4(color, alpha);
  }
`;

export const ensembleVertexShader = /* glsl */ `
  uniform float uSpread;

  attribute vec3 aColor;
  attribute vec3 aOffset;
  attribute float aProgress;
  attribute float aWeight;
  attribute float aSeed;
  attribute float aMember;

  varying vec3 vColor;
  varying float vProgress;
  varying float vWeight;
  varying float vSeed;
  varying float vFacing;
  varying float vMember;

  void main() {
    vec3 base = position;
    vec3 pos = base + aOffset * uSpread;

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vec3 outward = normalize(mat3(modelMatrix) * normalize(base));
    float facing = dot(outward, normalize(cameraPosition - world.xyz));

    vColor = aColor;
    vProgress = aProgress;
    vWeight = aWeight;
    vSeed = aSeed;
    vMember = aMember;
    vFacing = smoothstep(-0.32, 0.55, facing);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const ensembleFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uDay;
  uniform float uLength;
  uniform float uReady;
  uniform float uOpacity;
  uniform float uFocus;

  varying vec3 vColor;
  varying float vProgress;
  varying float vWeight;
  varying float vSeed;
  varying float vFacing;
  varying float vMember;

  void main() {
    // Each member draws onto the globe only once its data exists. uReady
    // trails the built-member count, so the newest track sweeps in.
    float reveal = clamp(uReady - vMember, 0.0, 1.0);
    float drawn = uLength * reveal;

    float draw = 1.0 - smoothstep(drawn - 0.008, drawn + 0.001, vProgress);
    float head = (1.0 - smoothstep(0.0, 0.045, abs(vProgress - drawn)))
      * reveal;
    float realised = step(0.5, vWeight);
    float resolution = smoothstep(0.62, 1.0, uDay);

    float baseAlpha = mix(0.40, 1.0, realised);
    float pulse = realised
      * (0.10 * sin(uTime * 1.6 + vProgress * 11.0 + vSeed * 6.28318) + 0.10);

    float alpha = (baseAlpha + pulse) * vFacing * draw * reveal;
    alpha += head * mix(0.06, 0.34, realised) * vFacing;
    alpha += (1.0 - draw)
      * mix(0.10, 0.26, realised)
      * vFacing
      * reveal;
    alpha *= uOpacity * (1.0 + resolution * realised * 0.35);
    alpha *= 1.0 - uFocus * 0.9;

    vec3 color = vColor;
    color += realised * head * vec3(0.16, 0.22, 0.24);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
