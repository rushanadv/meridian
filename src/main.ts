import { initPointer, pointer } from "./lib/pointer";
import { initScroll } from "./lib/scroll";
import { reducedMotion } from "./lib/motion";
import { initCursor } from "./ui/cursor";
import { initNav } from "./ui/nav";
import { runPreloader } from "./ui/preloader";
import { revealHero } from "./ui/reveal";
import { MeridianScene } from "./webgl/Scene";

document.documentElement.classList.remove("no-js");
document.body.classList.add("is-loading");

initPointer();
initNav();
initScroll();

const canvas = document.getElementById("webgl");
let scene: MeridianScene | null = null;

if (canvas instanceof HTMLCanvasElement) {
  try {
    scene = new MeridianScene(canvas);
  } catch (error) {
    console.error("Meridian: WebGL scene failed to initialise", error);
    document.body.classList.add("no-webgl");
  }
}

const coords = document.getElementById("coords");

if (coords) {
  let lastLabel = "";

  const formatCoordinate = (value: number, positive: string, negative: string) => {
    const hemisphere = value >= 0 ? positive : negative;
    return `${Math.abs(value).toFixed(2)}°${hemisphere}`;
  };

  window.addEventListener(
    "pointermove",
    () => {
      const latitude = 90 - pointer.py * 180;
      const longitude = pointer.px * 360 - 180;
      const label = `${formatCoordinate(latitude, "N", "S")} ${formatCoordinate(longitude, "E", "W")}`;

      if (label !== lastLabel) {
        coords.textContent = label;
        lastLabel = label;
      }
    },
    { passive: true },
  );
}

initCursor({
  isOverGlobe: (clientX, clientY) =>
    scene?.isPointerOverGlobe(clientX, clientY) ?? false,
});

runPreloader({
  onProgress: (value) => {
    scene?.setAssemble(value);
  },
  onDone: () => {
    document.body.classList.remove("is-loading");
    revealHero();

    if (reducedMotion.matches) {
      scene?.stop();
    }
  },
});

window.addEventListener("pagehide", () => {
  scene?.dispose();
});
