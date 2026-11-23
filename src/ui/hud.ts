import { gsap } from "../lib/motion";
import { choreo } from "../lib/choreography";
import type { MeridianScene, StormHud } from "../webgl/Scene";

interface HudOptions {
  scene: MeridianScene | null;
}

export function initHud({ scene }: HudOptions): void {
  const label = document.getElementById("storm-label");
  const states = Array.from(
    document.querySelectorAll<HTMLElement>("[data-hud-state]"),
  );

  if (!scene || !label) return;

  const hud: StormHud = { x: 0, y: 0, weight: 0 };
  let lastActive = -1;

  window.addEventListener(
    "pointermove",
    (event) => {
      const near = scene.isPointerNearStorm(event.clientX, event.clientY);
      scene.setStormHover(near);
      label.classList.toggle("is-hover", near);
    },
    { passive: true },
  );

  document.addEventListener("pointerleave", () => {
    scene.setStormHover(false);
    label.classList.remove("is-hover");
  });

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const tick = () => {
    scene.getStormHud(hud);

    const visible = hud.weight > 0.05;
    label.classList.toggle("is-on", visible);

    if (visible) {
      const marginX = window.innerWidth < 720 ? 100 : 130;
      const offset = window.innerWidth < 720 ? 0 : 46;
      const x = clamp(hud.x + offset, marginX, window.innerWidth - marginX);
      const y = clamp(hud.y, 130, window.innerHeight - 60);
      label.style.setProperty("--sx", `${x}px`);
      label.style.setProperty("--sy", `${y}px`);
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
