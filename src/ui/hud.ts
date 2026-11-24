import { gsap, isCoarsePointer, reducedMotion } from "../lib/motion";
import { choreo } from "../lib/choreography";
import type { MeridianScene, StormHud } from "../webgl/Scene";

interface HudOptions {
  scene: MeridianScene | null;
}

export function initHud({ scene }: HudOptions): void {
  const label = document.getElementById("storm-label");
  const heroSpread = document.getElementById("ensemble-spread");
  const stormSpread = document.getElementById("storm-spread");
  const states = Array.from(
    document.querySelectorAll<HTMLElement>("[data-hud-state]"),
  );

  if (!scene || !label) return;

  const hud: StormHud = { x: 0, y: 0, weight: 0 };
  let lastActive = -1;
  let lastSpread = -1;

  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;

      const near = scene.isPointerNearStorm(event.clientX, event.clientY);
      scene.setStormHover(near);
      label.classList.toggle("is-hover", near);
    },
    { passive: true },
  );

  document.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;

    scene.setStormHover(false);
    label.classList.remove("is-hover");
  });

  if (isCoarsePointer && !reducedMotion.matches) {
    let tapTimer = 0;

    const tap = (clientX: number, clientY: number) => {
      if (!scene.isPointerNearStorm(clientX, clientY)) return;

      scene.setStormHover(true);
      label.classList.add("is-hover");
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(() => {
        scene.setStormHover(false);
        label.classList.remove("is-hover");
      }, 1600);
    };

    window.addEventListener(
      "pointerdown",
      (event) => tap(event.clientX, event.clientY),
      { passive: true },
    );

    window.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        if (touch) tap(touch.clientX, touch.clientY);
      },
      { passive: true },
    );
  }

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const tick = () => {
    scene.getStormHud(hud);

    const visible = hud.weight > 0.05;
    label.classList.toggle("is-on", visible);

    if (visible) {
      const marginX = window.innerWidth < 720 ? 105 : 140;
      const offset = window.innerWidth < 720 ? 0 : 110;
      const x = clamp(hud.x + offset, marginX, window.innerWidth - marginX);
      const y = clamp(hud.y, 130, window.innerHeight - 60);
      label.style.setProperty("--sx", `${x}px`);
      label.style.setProperty("--sy", `${y}px`);
    }

    const spread = Math.pow(1 - choreo.uDay, 1.2);

    if (Math.abs(spread - lastSpread) >= 0.005) {
      const value = spread.toFixed(2);
      if (heroSpread) heroSpread.textContent = `Spread ${value}`;
      if (stormSpread) stormSpread.textContent = value;
      lastSpread = spread;
    }

    const active =
      choreo.state < 0.35 ? 0 : choreo.state < 1.35 ? 1 : 2;

    if (active !== lastActive) {
      states.forEach((element, index) => {
        element.classList.toggle("is-active", index === active);
      });
      lastActive = active;
    }
  };

  gsap.ticker.add(tick);
}
