import { initPointer } from "./lib/pointer";
import { applyHashRoute, initSections } from "./lib/sections";
import { initScroll } from "./lib/scroll";
import { choreo } from "./lib/choreography";
import { initMagnetic } from "./lib/magnetic";
import { reducedMotion, ScrollTrigger } from "./lib/motion";
import { initProbe } from "./ui/coordinates";
import { initCursor } from "./ui/cursor";
import { initDayRail } from "./ui/dayRail";
import { initForecastClock } from "./ui/forecastClock";
import { initFooter } from "./ui/footer";
import { initHorizon } from "./ui/horizon";
import { initHud } from "./ui/hud";
import { initNav } from "./ui/nav";
import { runPreloader } from "./ui/preloader";
import { revealHero, revealHeroChrome } from "./ui/reveal";
import { initRoutesPanel } from "./ui/routes";
import { initViewTransition } from "./ui/transition";
import { MeridianScene } from "./webgl/Scene";

document.documentElement.classList.remove("no-js");
document.body.classList.add("is-loading");

initPointer();
initSections();
const scroll = initScroll();
initNav(scroll);
const dayRail = initDayRail(scroll);

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

const probe = initProbe(scene);
initForecastClock();

initCursor({
  isOverGlobe: (clientX, clientY) =>
    scene?.isPointerOverGlobe(clientX, clientY) ?? false,
  probeLabel: (clientX, clientY) => probe.textAt(clientX, clientY),
});

initHud({ scene });

initRoutesPanel({
  onSelect: (index) => scene?.setRouteFocus(index),
  onReplay: () => scene?.replayReroute(),
});
initMagnetic();
initHorizon({
  onHover: (active) => scene?.setPricingHover(active),
});
initFooter();
initViewTransition(scroll);

window.addEventListener("hashchange", () => applyHashRoute(scroll));

requestAnimationFrame(() => {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
});

if (import.meta.env.DEV) {
  (window as Window & { __meridian?: unknown }).__meridian = {
    choreo,
    scene,
    triggers: () =>
      ScrollTrigger.getAll().map((trigger) => ({
        target:
          trigger.trigger instanceof Element
            ? trigger.trigger.id || trigger.trigger.className
            : "?",
        start: Math.round(trigger.start),
        end: Math.round(trigger.end),
        progress: Number(trigger.progress.toFixed(3)),
      })),
  };
}

runPreloader({
  scene,
  onReveal: revealHero,
  onDone: () => {
    document.body.classList.remove("is-loading");
    revealHeroChrome();
    applyHashRoute(scroll);

    if (reducedMotion.matches) {
      scene?.stop();
    }
  },
});

window.addEventListener("pagehide", () => {
  dayRail?.destroy();
  scroll.destroy();
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  scene?.dispose();
});
