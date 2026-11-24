import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";
import { gsap, reducedMotion } from "../lib/motion";
import type { ScrollController } from "../lib/scroll";

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;

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
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p = p * 2.03 + vec2(9.1, 17.7);
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = (uv - 0.5) * vec2(uAspect, 1.0);
    float radius = length(centered);

    float drift = uTime * 0.045;
    float broad = fbm(uv * vec2(uAspect, 1.0) * 3.4 + vec2(drift, -drift * 0.7));
    float fine = fbm(uv * 8.2 - vec2(drift * 0.5, drift));
    float ripple = sin(radius * 20.0 - uTime * 0.9 + broad * 5.0) * 0.035;

    float distanceField = radius + broad * 0.18 + fine * 0.05 + ripple;
    float edge = mix(
      -0.25,
      1.6,
      pow(clamp(uProgress, 0.0, 1.0), 0.62)
    );

    float cover = 1.0 - smoothstep(edge - 0.085, edge + 0.085, distanceField);
    float rim = 1.0 - smoothstep(0.0, 0.16, abs(distanceField - edge));

    vec3 deep = vec3(0.012, 0.03, 0.04);
    vec3 ink = vec3(0.03, 0.11, 0.13);
    vec3 glow = vec3(0.32, 0.82, 0.94);

    vec3 color = mix(deep, ink, clamp(broad * 1.3 + fine * 0.4, 0.0, 1.0));
    color += glow * rim * 0.85;

    gl_FragColor = vec4(color, cover * 0.985);
  }
`;

export function initViewTransition(scroll: ScrollController): void {
  const canvas = document.getElementById(
    "dissolve",
  ) as HTMLCanvasElement | null;
  if (!canvas) return;

  let renderer: WebGLRenderer | null = null;
  let material: ShaderMaterial | null = null;
  let scene: Scene | null = null;
  let camera: OrthographicCamera | null = null;
  let frame = 0;
  let busy = false;

  const uniforms = {
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  };

  const renderFrame = (time: number) => {
    if (!renderer || !scene || !camera) return;
    uniforms.uTime.value = time / 1000;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(renderFrame);
  };

  const resize = () => {
    if (!renderer || !material) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    material.uniforms.uAspect.value =
      window.innerWidth / window.innerHeight;
  };

  const dispose = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    canvas.style.display = "none";

    scene?.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });

    material?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();

    renderer = null;
    material = null;
    scene = null;
    camera = null;
  };

  window.addEventListener("pagehide", dispose, { once: true });

  const ensure = (): boolean => {
    if (renderer && material) return true;

    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "low-power",
        premultipliedAlpha: false,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight, false);

      material = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });

      scene = new Scene();
      camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      scene.add(new Mesh(new PlaneGeometry(2, 2), material));
      resize();
      return true;
    } catch {
      renderer = null;
      material = null;
      scene = null;
      camera = null;
      return false;
    }
  };

  const play = (onJump: () => void) => {
    if (busy) return;

    if (reducedMotion.matches) {
      onJump();
      return;
    }

    if (!ensure()) {
      onJump();
      return;
    }

    busy = true;
    canvas.style.display = "block";
    uniforms.uProgress.value = 0;
    frame = requestAnimationFrame(renderFrame);

    const state = { value: 0 };
    const paint = () => {
      uniforms.uProgress.value = state.value;
    };

    gsap
      .timeline({
        onComplete: () => {
          busy = false;
          canvas.style.display = "none";
          if (frame) cancelAnimationFrame(frame);
          frame = 0;
        },
      })
      .to(state, {
        value: 1,
        duration: 0.55,
        ease: "power2.in",
        onUpdate: paint,
      })
      .add(() => onJump())
      .to(
        state,
        {
          value: 0,
          duration: 0.68,
          ease: "power2.out",
          onUpdate: paint,
        },
        "+=0.05",
      );
  };

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as Element | null;
      const link = target?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      if (link.classList.contains("skip-link") || link.closest("#menu")) return;

      const href = link.getAttribute("href");
      if (!href || href === "#") return;

      event.preventDefault();
      event.stopPropagation();

      play(() => scroll.scrollTo(href, true));
    },
    true,
  );

  window.addEventListener(
    "resize",
    () => {
      if (busy) resize();
    },
    { passive: true },
  );
}
