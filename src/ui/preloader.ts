import { reducedMotion } from "../lib/motion";
import type { MeridianScene } from "../webgl/Scene";

interface PreloaderOptions {
  scene: MeridianScene | null;
  onReveal: () => void;
  onDone: () => void;
}

/** When the opaque cover lifts to reveal the globe and the hero copy. */
const FRAME_AT = 900;
/** Let the first member read as MEMBER 01 / 51 before the build ramps. */
const BUILD_START = 200;
/** How long the member build takes from the first to the fifty-first. */
const BUILD_END = 2350;
/** Absolute guard so a stalled frame or GPU never traps the page. */
const FAILSAFE = 6200;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/**
 * The opening sequence. The counter is not a timer: it reports real ensemble
 * initialization, because each tick builds the actual control points and
 * spline samples for the members it reports. Each track draws onto the globe
 * as its data lands; once all fifty-one exist, the fan opens to full spread.
 * The hero copy reveals on a DOM-only clock, so it never waits on WebGL.
 */
export function runPreloader({
  scene,
  onReveal,
  onDone,
}: PreloaderOptions): void {
  const root = document.getElementById("preloader");
  const count = document.getElementById("load-count");
  const compact = document.getElementById("load-compact");
  const bar = document.getElementById("load-bar");

  const total = scene?.ensembleSize ?? 51;
  let done = false;

  const finish = (): void => {
    if (done) return;
    done = true;
    root?.classList.add("is-done");
    window.setTimeout(
      () => {
        root?.remove();
        onDone();
      },
      reducedMotion.matches ? 0 : 560,
    );
  };

  const display = (built: number): void => {
    const shown = Math.max(1, Math.min(total, built));
    if (count) count.textContent = pad2(shown);
    if (compact) compact.textContent = `MEMBER ${pad2(shown)} / ${total}`;
    if (bar) bar.style.transform = `scaleX(${shown / total})`;
  };

  if (!root || !count || !bar) {
    onReveal();
    finish();
    return;
  }

  // No WebGL: the copy is the page. Reveal it at once and drop the overlay.
  if (!scene) {
    display(total);
    onReveal();
    finish();
    return;
  }

  if (reducedMotion.matches) {
    scene.setAssemble(1);
    scene.assembleMembers(total);
    scene.playEnsembleIntro();
    display(total);
    onReveal();
    finish();
    return;
  }

  const start = performance.now();
  let frame = 0;
  let revealed = false;
  let last = 0;
  let stopped = false;

  const reveal = (): void => {
    if (revealed) return;
    revealed = true;
    onReveal();
  };

  const settle = (): void => {
    scene.setAssemble(1);
    scene.assembleMembers(total);
    scene.playEnsembleIntro();
    display(total);
    reveal();
    finish();
    stopped = true;
  };

  const tick = (now: number): void => {
    if (stopped) return;
    const t = now - start;

    // Planet first, over the first beat, then the members draw across it.
    scene.setAssemble(Math.min(1, t / 780));

    const target = Math.min(
      total,
      1 +
        Math.floor(
          (Math.max(0, t - BUILD_START) / BUILD_END) * (total - 1),
        ),
    );
    const built = scene.assembleMembers(target);

    if (built !== last) {
      display(built);
      last = built;
    }

    if (!revealed && t >= FRAME_AT) {
      root.classList.add("is-frame");
      reveal();
    }

    if (built >= total) {
      reveal();
      scene.playEnsembleIntro();
      display(total);
      finish();
      stopped = true;
      return;
    }

    if (t >= FAILSAFE) {
      settle();
      return;
    }

    frame = requestAnimationFrame(tick);
  };

  display(1);
  frame = requestAnimationFrame(tick);

  window.addEventListener(
    "pagehide",
    () => {
      stopped = true;
      cancelAnimationFrame(frame);
    },
    { once: true },
  );
}