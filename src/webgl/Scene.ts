import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Globe } from "./Globe";
import { Storm } from "./storm";
import { Routes } from "./routes";
import { gradeShader } from "./shaders";
import { pointer } from "../lib/pointer";
import {
  choreo,
  routesWeightOf,
  stormWeightOf,
} from "../lib/choreography";
import { reducedMotion } from "../lib/motion";

interface CameraKey {
  position: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

export interface StormHud {
  x: number;
  y: number;
  weight: number;
}

export class MeridianScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly renderPass: RenderPass;
  private readonly globe = new Globe();
  private readonly storm = new Storm();
  private readonly routes = new Routes();
  private readonly timer = new THREE.Timer();

  private keys!: {
    orbit: CameraKey;
    storm: CameraKey;
    routes: CameraKey;
  };

  private readonly smoothPointer = new THREE.Vector2(0, 0);
  private readonly globeCenter = new THREE.Vector3();
  private readonly stormWorld = new THREE.Vector3();
  private readonly stormLocalDir = new THREE.Vector3();
  private readonly stormPointer = new THREE.Vector2(1e3, 1e3);

  private readonly posePos = new THREE.Vector3();
  private readonly poseLook = new THREE.Vector3();
  private readonly rigPos = new THREE.Vector3();
  private readonly rigLook = new THREE.Vector3();
  private readonly tmpWorld = new THREE.Vector3();
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpLocal = new THREE.Vector3();
  private readonly hudProjection = new THREE.Vector3();
  private readonly rayNdc = new THREE.Vector2();

  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane();

  private rigFov = 42;
  private poseFov = 42;
  private portrait = false;
  private rigReady = false;
  private hover = 0;
  private hoverTarget = 0;
  private stormWeight = 0;

  private reduced = reducedMotion.matches;
  private running = false;
  private manualStop = false;
  private pixelRatio = 1;

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

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });

    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setClearColor(0x05070d, 1);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#05070d");

    this.globe.group.add(this.routes.group);
    this.scene.add(this.globe.root, this.storm.root);

    this.camera = new THREE.PerspectiveCamera(
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
      new THREE.Vector2(width, height),
      0.62,
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

    this.composer.addPass(new OutputPass());
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

  setStormHover(active: boolean): void {
    this.hoverTarget = active ? 1 : 0;
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
    const nextRatio = Math.min(window.devicePixelRatio, 2);

    this.pixelRatio = nextRatio;

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
    this.globe.getWorldCenter(this.globeCenter);
    this.globeCenter.project(this.camera);

    const screenX = (this.globeCenter.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-this.globeCenter.y * 0.5 + 0.5) * window.innerHeight;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.34;

    return Math.hypot(clientX - screenX, clientY - screenY) < radius;
  }

  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    reducedMotion.removeEventListener("change", this.onMotionPreference);
    this.globe.group.remove(this.routes.group);
    this.routes.dispose();
    this.storm.dispose();
    this.globe.dispose();
    this.composer.dispose();
    this.renderer.dispose();
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
    const direction = new THREE.Vector3(-0.4, 1.0, 1.22).normalize();

    this.stormWorld.copy(center).addScaledVector(direction, 2.62);
    this.storm.root.position.copy(this.stormWorld);

    const orbit: CameraKey = portrait
      ? {
          position: new THREE.Vector3(0, 0.4, 13.2),
          look: new THREE.Vector3(0, 0.45, 0),
          fov: 42,
        }
      : {
          position: new THREE.Vector3(0, 0.15, 8.5),
          look: new THREE.Vector3(0, 0.1, 0),
          fov: 42,
        };

    const storm: CameraKey = {
      position: center
        .clone()
        .addScaledVector(direction, portrait ? 7.8 : 5.9),
      look: this.stormWorld
        .clone()
        .addScaledVector(direction, portrait ? -0.6 : -0.35)
        .add(new THREE.Vector3(-0.85, -0.1, 0)),
      fov: portrait ? 48 : 42,
    };

    const routes: CameraKey = {
      position: center
        .clone()
        .add(
          new THREE.Vector3(
            portrait ? 0.5 : 0.8,
            portrait ? 6.2 : 3.4,
            portrait ? 17.5 : 11.2,
          ),
        ),
      look: center.clone().add(new THREE.Vector3(0, portrait ? 0 : 0.05, 0)),
      fov: portrait ? 40 : 38,
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
    this.poseFov = THREE.MathUtils.lerp(from.fov, to.fov, weight);

    if (this.reduced || !this.rigReady) {
      this.rigPos.copy(this.posePos);
      this.rigLook.copy(this.poseLook);
      this.rigFov = this.poseFov;
    } else {
      const k = 1 - Math.exp(-3.4 * delta);
      this.rigPos.lerp(this.posePos, k);
      this.rigLook.lerp(this.poseLook, k);
      this.rigFov = THREE.MathUtils.damp(this.rigFov, this.poseFov, 3, delta);
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
      1 -
        this.stormWeight * (this.portrait ? 0.68 : 0.5) -
        routesWeight * (this.portrait ? 0.1 : 0.15),
    );

    this.storm.update(time, this.stormWeight, this.hover, this.stormPointer);
    this.routes.update(time, routesWeight);
    this.updateRig(0);
    this.composer.render();
  }

  private readonly animate = (): void => {
    this.timer.update();

    const delta = Math.min(this.timer.getDelta(), 0.05);

    this.smoothPointer.x = THREE.MathUtils.damp(
      this.smoothPointer.x,
      pointer.tx,
      4,
      delta,
    );
    this.smoothPointer.y = THREE.MathUtils.damp(
      this.smoothPointer.y,
      pointer.ty,
      3.6,
      delta,
    );

    this.stormWeight = stormWeightOf(choreo.state);
    const routesWeight = routesWeightOf(choreo.state);
    this.hover = THREE.MathUtils.damp(this.hover, this.hoverTarget, 6, delta);

    const time = this.reduced ? 0.8 : this.timer.getElapsed();

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
      1 -
        this.stormWeight * (this.portrait ? 0.68 : 0.5) -
        routesWeight * (this.portrait ? 0.1 : 0.15),
    );

    this.storm.update(time, this.stormWeight, this.hover, this.stormPointer);
    this.routes.update(time, routesWeight);

    this.updateRig(delta);

    if (this.stormWeight > 0.02) {
      this.trackStormPointer();
    }

    this.grade.uniforms.uTime.value = this.reduced ? 0.4 : time;

    this.composer.render();
  };
}
