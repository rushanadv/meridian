import {
  ACESFilmicToneMapping, Color, MathUtils, PerspectiveCamera, Plane, Raycaster,
  Scene as ThreeScene, Sphere, Timer, Vector2, Vector3, WebGLRenderer,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Globe } from "./Globe";
import { Ensemble, ENSEMBLE_ORIGIN } from "./ensemble";
import { Storm } from "./storm";
import { Routes } from "./routes";
import { PricingField } from "./pricing";
import { gradeShader } from "./shaders";
import { pointer } from "../lib/pointer";
import {
  choreo,
  routesWeightOf,
  stormWeightOf,
} from "../lib/choreography";
import { gsap, reducedMotion, isCoarsePointer } from "../lib/motion";

interface CameraKey {
  position: Vector3;
  look: Vector3;
  fov: number;
}

export interface StormHud {
  x: number;
  y: number;
  weight: number;
}

export class MeridianScene {
  private readonly renderer: WebGLRenderer;
  private readonly camera: PerspectiveCamera;
  private readonly scene: ThreeScene;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly renderPass: RenderPass;
  private readonly output: OutputPass;
  private readonly globe = new Globe();
  private readonly ensemble = new Ensemble();
  private readonly storm = new Storm();
  private readonly routes = new Routes();
  private readonly pricing = new PricingField();
  private readonly timer = new Timer();
  private readonly intro = { value: 0 };

  private keys!: {
    orbit: CameraKey;
    storm: CameraKey;
    routes: CameraKey;
  };

  private readonly smoothPointer = new Vector2(0, 0);
  private readonly globeCenter = new Vector3();
  private readonly stormWorld = new Vector3();
  private readonly stormLocalDir = new Vector3();
  private readonly stormPointer = new Vector2(1e3, 1e3);

  private readonly posePos = new Vector3();
  private readonly poseLook = new Vector3();
  private readonly rigPos = new Vector3();
  private readonly rigLook = new Vector3();
  private readonly tmpWorld = new Vector3();
  private readonly tmpDir = new Vector3();
  private readonly tmpLocal = new Vector3();
  private readonly hudProjection = new Vector3();
  private readonly rayNdc = new Vector2();

  private readonly raycaster = new Raycaster();
  private readonly plane = new Plane();
  private readonly surfaceSphere = new Sphere();
  private readonly surfaceHit = new Vector3();
  private readonly surfaceLocal = new Vector3();

  private rigFov = 42;
  private poseFov = 42;
  private portrait = false;
  private rigReady = false;
  private hover = 0;
  private hoverTarget = 0;
  private pricingHover = 0;
  private pricingHoverTarget = 0;
  private stormWeight = 0;

  private reduced = reducedMotion.matches;
  private running = false;
  private manualStop = false;
  private pixelRatio = 1;
  private mobileQuality = false;

  private qualityPixelRatio(): number {
    this.mobileQuality = isCoarsePointer || window.innerWidth < 720;
    return Math.min(
      window.devicePixelRatio,
      this.mobileQuality ? 1.5 : 2,
    );
  }

  private readonly onResize = () => this.resize();
  private readonly onVisibility = () => {
    if (document.hidden) {
      this.renderer.setAnimationLoop(null);
      this.running = false;
    } else if (!this.manualStop) {
      this.start();
    }
  };
  private readonly onMotionPreference = () => {
    this.reduced = reducedMotion.matches;
    if (!this.running) this.renderOnce();
  };

  constructor(canvas: HTMLCanvasElement) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });

    this.pixelRatio = this.qualityPixelRatio();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor(0x05070d, 1);

    this.scene = new ThreeScene();
    this.scene.background = new Color("#05070d");

    this.globe.group.add(this.ensemble.group, this.routes.group);
    this.scene.add(this.globe.root, this.storm.root, this.pricing.root);

    this.camera = new PerspectiveCamera(
      42,
      width / height,
      0.1,
      120,
    );

    this.renderPass = new RenderPass(this.scene, this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(
      new Vector2(width, height),
      this.mobileQuality ? 0.5 : 0.62,
      0.5,
      0.6,
    );
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(gradeShader);
    this.grade.uniforms.uResolution.value.set(
      width * this.pixelRatio,
      height * this.pixelRatio,
    );
    this.composer.addPass(this.grade);

    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.composer.setSize(width, height);

    this.timer.connect(document);

    this.layout(width, height);
    this.globe.resize(height, this.pixelRatio);
    this.storm.resize(height, this.pixelRatio);
    this.updateRig(0);

    window.addEventListener("resize", this.onResize, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    reducedMotion.addEventListener("change", this.onMotionPreference);

    this.start();
  }

  setAssemble(value: number): void {
    this.globe.setAssemble(value);
  }

  playEnsembleIntro(): void {
    if (this.reduced) {
      this.ensemble.setIntro(1);
      this.renderOnce();
      return;
    }

    gsap.to(this.intro, {
      value: 1,
      duration: 1.6,
      ease: "power4InOut",
      overwrite: true,
      onUpdate: () => this.ensemble.setIntro(this.intro.value),
    });
  }

  setStormHover(active: boolean): void {
    this.hoverTarget = active ? 1 : 0;
  }

  setRouteFocus(index: number): void {
    this.routes.setActive(index);

    if (this.reduced) this.renderOnce();
  }

  setPricingHover(active: boolean): void {
    this.pricingHoverTarget = active ? 1 : 0;

    if (this.reduced) this.renderOnce();
  }

  getStormHud(out: StormHud): void {
    this.hudProjection.copy(this.stormWorld).project(this.camera);
    out.x = (this.hudProjection.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-this.hudProjection.y * 0.5 + 0.5) * window.innerHeight;
    out.weight = stormWeightOf(choreo.state);
  }

  isPointerNearStorm(clientX: number, clientY: number): boolean {
    const weight = stormWeightOf(choreo.state);
    if (weight < 0.06) return false;

    this.hudProjection.copy(this.stormWorld).project(this.camera);
    if (this.hudProjection.z > 1) return false;

    const screenX = (this.hudProjection.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-this.hudProjection.y * 0.5 + 0.5) * window.innerHeight;
    const radius =
      Math.min(window.innerWidth, window.innerHeight) *
        (0.12 + weight * 0.05) +
      18;

    return Math.hypot(clientX - screenX, clientY - screenY) < radius;
  }

  start(): void {
    this.manualStop = false;
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(this.animate);
  }

  stop(): void {
    this.manualStop = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nextRatio = this.qualityPixelRatio();

    this.pixelRatio = nextRatio;
    this.bloom.strength = this.mobileQuality ? 0.5 : 0.62;

    this.renderer.setPixelRatio(nextRatio);
    this.renderer.setSize(width, height);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.composer.setPixelRatio(nextRatio);
    this.composer.setSize(width, height);

    this.grade.uniforms.uResolution.value.set(
      width * nextRatio,
      height * nextRatio,
    );

    this.globe.resize(height, nextRatio);
    this.storm.resize(height, nextRatio);
    this.layout(width, height);

    if (!this.running) this.renderOnce();
  }

  isPointerOverGlobe(clientX: number, clientY: number): boolean {
    if (choreo.veil > 0.35) return false;

    this.globe.getWorldCenter(this.globeCenter);
    this.globeCenter.project(this.camera);

    const screenX = (this.globeCenter.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-this.globeCenter.y * 0.5 + 0.5) * window.innerHeight;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.34;

    return Math.hypot(clientX - screenX, clientY - screenY) < radius;
  }

  getSurfaceCoordinate(
    clientX: number,
    clientY: number,
  ): { lat: number; lon: number } | null {
    this.rayNdc.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.rayNdc, this.camera);

    this.globe.getWorldCenter(this.globeCenter);
    this.surfaceSphere.set(this.globeCenter, this.globe.radius);

    const hit = this.raycaster.ray.intersectSphere(
      this.surfaceSphere,
      this.surfaceHit,
    );

    if (!hit) return null;

    this.globe.group.updateMatrixWorld(true);
    this.surfaceLocal.copy(this.surfaceHit);
    this.globe.group.worldToLocal(this.surfaceLocal).normalize();

    return {
      lat: MathUtils.radToDeg(
        Math.asin(MathUtils.clamp(this.surfaceLocal.y, -1, 1)),
      ),
      lon: MathUtils.radToDeg(
        Math.atan2(this.surfaceLocal.z, this.surfaceLocal.x),
      ),
    };
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    reducedMotion.removeEventListener("change", this.onMotionPreference);
    this.globe.group.remove(this.ensemble.group, this.routes.group);
    this.ensemble.dispose();
    this.routes.dispose();
    this.storm.dispose();
    this.globe.dispose();
    this.pricing.dispose();
    this.bloom.dispose();
    this.grade.dispose();
    this.output.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private layout(width: number, height: number): void {
    const portrait = width / height < 0.9;
    this.portrait = portrait;

    this.globe.group.position.set(
      portrait ? 0 : 1.02,
      portrait ? 0.42 : 0.12,
      0,
    );

    const center = this.globe.group.position;
    const latitude = ENSEMBLE_ORIGIN.lat * Math.PI / 180;
    const longitude = ENSEMBLE_ORIGIN.lon * Math.PI / 180;
    const genesis = new Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude),
    )
      .normalize()
      .multiplyScalar(2.62);

    this.globe.group.updateMatrixWorld(true);
    this.stormWorld.copy(genesis).applyMatrix4(this.globe.group.matrixWorld);
    this.storm.root.position.copy(this.stormWorld);

    const direction = this.stormWorld.clone().sub(center).normalize();

    const orbit: CameraKey = portrait
      ? {
          position: new Vector3(0, 0.4, 13.2),
          look: new Vector3(0, 0.45, 0),
          fov: 42,
        }
      : {
          position: new Vector3(0, 0.15, 8.5),
          look: new Vector3(0, 0.1, 0),
          fov: 42,
        };

    const storm: CameraKey = {
      position: center
        .clone()
        .addScaledVector(direction, portrait ? 10 : 9),
      look: this.stormWorld
        .clone()
        .addScaledVector(direction, portrait ? 0 : -0.3)
        .add(
          new Vector3(
            portrait ? 0 : -1,
            portrait ? -1.2 : 0.4,
            0,
          ),
        ),
      fov: portrait ? 48 : 42,
    };

    const routes: CameraKey = {
      position: center
        .clone()
        .add(
          new Vector3(
            portrait ? 0.4 : 1.5,
            portrait ? 2.2 : 2.9,
            portrait ? 6.9 : 7,
          ),
        ),
      look: center
        .clone()
        .add(
          new Vector3(
            portrait ? -0.1 : -0.2,
            portrait ? 2.4 : 0.05,
            0,
          ),
        ),
      fov: portrait ? 44 : 42,
    };

    this.keys = { orbit, storm, routes };
  }

  private updateRig(delta: number): void {
    const state = Math.min(2, Math.max(0, choreo.state));
    const from = state <= 1 ? this.keys.orbit : this.keys.storm;
    const to = state <= 1 ? this.keys.storm : this.keys.routes;

    let weight = state <= 1 ? state : state - 1;
    weight = weight * weight * (3 - 2 * weight);

    this.posePos.lerpVectors(from.position, to.position, weight);
    this.poseLook.lerpVectors(from.look, to.look, weight);
    this.poseFov = MathUtils.lerp(from.fov, to.fov, weight);

    if (this.reduced || !this.rigReady) {
      this.rigPos.copy(this.posePos);
      this.rigLook.copy(this.poseLook);
      this.rigFov = this.poseFov;
    } else {
      const k = 1 - Math.exp(-3.4 * delta);
      this.rigPos.lerp(this.posePos, k);
      this.rigLook.lerp(this.poseLook, k);
      this.rigFov = MathUtils.damp(this.rigFov, this.poseFov, 3, delta);
    }

    this.camera.position.copy(this.rigPos);
    this.camera.lookAt(this.rigLook);

    if (Math.abs(this.camera.fov - this.rigFov) > 0.001) {
      this.camera.fov = this.rigFov;
      this.camera.updateProjectionMatrix();
    }

    this.rigReady = true;
  }

  private trackStormPointer(): void {
    this.rayNdc.set(pointer.tx, pointer.ty);
    this.camera.getWorldDirection(this.tmpDir);
    this.plane.setFromNormalAndCoplanarPoint(this.tmpDir, this.stormWorld);
    this.raycaster.setFromCamera(this.rayNdc, this.camera);

    const hit = this.raycaster.ray.intersectPlane(this.plane, this.tmpWorld);
    if (hit) {
      this.storm.localPoint(this.tmpWorld, this.stormPointer);
    }
  }

  private renderOnce(): void {
    const time = this.reduced ? 0.8 : this.timer.getElapsed();
    this.stormWeight = stormWeightOf(choreo.state);
    const routesWeight = routesWeightOf(choreo.state);
    const contentFade = 1 - choreo.veil;

    this.ensemble.setDay(this.reduced ? 0 : choreo.uDay);
    this.ensemble.update(time, 0, this.reduced);

    this.globe.setVeil(choreo.veil);
    this.globe.update(
      time,
      0,
      this.smoothPointer,
      this.stormWeight,
      this.reduced,
    );
    this.globe.root.updateMatrixWorld(true);

    this.tmpLocal.copy(this.stormWorld);
    this.globe.group.worldToLocal(this.tmpLocal);
    this.stormLocalDir.copy(this.tmpLocal).normalize();
    this.globe.setStorm(
      this.stormLocalDir,
      this.stormWeight * 0.4,
      (1 -
        this.stormWeight * (this.portrait ? 0.68 : 0.5) -
        routesWeight * (this.portrait ? 0.1 : 0.15)) *
        (1 - choreo.veil),
    );

    this.storm.update(time, this.stormWeight, this.hover, this.stormPointer);
    this.routes.update(time, routesWeight * contentFade, 0);
    this.pricingHover = this.pricingHoverTarget;
    this.pricing.update(
      time,
      choreo.pricing,
      this.pricingHover,
      this.smoothPointer,
      this.camera.aspect,
    );
    this.updateRig(0);
    this.composer.render();
  }

  private readonly animate = (): void => {
    this.timer.update();

    const delta = Math.min(this.timer.getDelta(), 0.05);

    this.smoothPointer.x = MathUtils.damp(
      this.smoothPointer.x,
      pointer.tx,
      4,
      delta,
    );
    this.smoothPointer.y = MathUtils.damp(
      this.smoothPointer.y,
      pointer.ty,
      3.6,
      delta,
    );

    this.stormWeight = stormWeightOf(choreo.state);
    const routesWeight = routesWeightOf(choreo.state);
    const contentFade = 1 - choreo.veil;
    this.hover = MathUtils.damp(this.hover, this.hoverTarget, 6, delta);

    const time = this.reduced ? 0.8 : this.timer.getElapsed();

    this.ensemble.setDay(this.reduced ? 0 : choreo.uDay);
    this.ensemble.update(time, delta, this.reduced);

    this.globe.setVeil(choreo.veil);
    this.globe.update(
      time,
      delta,
      this.smoothPointer,
      this.stormWeight,
      this.reduced,
    );
    this.globe.root.updateMatrixWorld(true);

    this.tmpLocal.copy(this.stormWorld);
    this.globe.group.worldToLocal(this.tmpLocal);
    this.stormLocalDir.copy(this.tmpLocal).normalize();
    this.globe.setStorm(
      this.stormLocalDir,
      this.stormWeight * (0.35 + this.hover * 0.9),
      (1 -
        this.stormWeight * (this.portrait ? 0.68 : 0.5) -
        routesWeight * (this.portrait ? 0.1 : 0.15)) *
        (1 - choreo.veil),
    );

    this.storm.update(time, this.stormWeight, this.hover, this.stormPointer);
    this.routes.update(time, routesWeight * contentFade, delta);

    this.pricingHover = MathUtils.damp(
      this.pricingHover,
      this.pricingHoverTarget,
      4,
      delta,
    );
    this.pricing.update(
      time,
      choreo.pricing,
      this.pricingHover,
      this.smoothPointer,
      this.camera.aspect,
    );

    this.updateRig(delta);

    if (this.stormWeight > 0.02) {
      this.trackStormPointer();
    }

    this.grade.uniforms.uTime.value = this.reduced ? 0.4 : time;

    this.composer.render();
  };
}
