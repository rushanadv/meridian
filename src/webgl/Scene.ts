import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Globe } from "./Globe";
import { gradeShader } from "./shaders";
import { pointer } from "../lib/pointer";
import { scrollState } from "../lib/scroll";
import { reducedMotion } from "../lib/motion";

export class MeridianScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly scene: THREE.Scene;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;
  private readonly renderPass: RenderPass;
  private readonly globe = new Globe();
  private readonly timer = new THREE.Timer();

  private readonly smoothPointer = new THREE.Vector2(0, 0);
  private readonly globeCenter = new THREE.Vector3();

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
    this.scene.add(this.globe.root);

    this.camera = new THREE.PerspectiveCamera(
      42,
      width / height,
      0.1,
      120,
    );
    this.camera.position.set(0, 0.15, 8.5);

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

    window.addEventListener("resize", this.onResize, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);
    reducedMotion.addEventListener("change", this.onMotionPreference);

    this.start();
  }

  setAssemble(value: number): void {
    this.globe.setAssemble(value);
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
    this.globe.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private layout(width: number, height: number): void {
    const portrait = width / height < 0.9;

    this.camera.position.z = portrait ? 13.2 : 8.5;
    this.camera.position.y = portrait ? 0.4 : 0.15;
    this.camera.lookAt(0, portrait ? 0.45 : 0.1, 0);

    this.globe.group.position.set(
      portrait ? 0 : 1.02,
      portrait ? 0.42 : 0.12,
      0,
    );
  }

  private renderOnce(): void {
    this.globe.update(
      this.reduced ? 0.8 : this.timer.getElapsed(),
      0,
      this.smoothPointer,
      scrollState.progress,
      this.reduced,
    );
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

    const time = this.reduced ? 0.8 : this.timer.getElapsed();

    this.globe.update(
      time,
      delta,
      this.smoothPointer,
      scrollState.progress,
      this.reduced,
    );

    this.grade.uniforms.uTime.value = this.reduced ? 0.4 : time;

    this.composer.render();
  };
}
