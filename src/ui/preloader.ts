import { gsap, reducedMotion } from "../lib/motion";

interface PreloaderOptions {
  onProgress: (value: number) => void;
  onDone: () => void;
}

const formatCount = (value: number) =>
  String(Math.min(100, Math.round(value))).padStart(3, "0");

export function runPreloader({ onProgress, onDone }: PreloaderOptions): void {
  const root = document.getElementById("preloader");
  const count = document.getElementById("load-count");
  const bar = document.getElementById("load-bar");

  if (!root || !count || !bar) {
    onProgress(1);
    onDone();
    return;
  }

  let finished = false;

  const commit = (value: number) => {
    const clamped = Math.min(100, Math.max(0, value));
    count.textContent = formatCount(clamped);
    bar.style.transform = `scaleX(${clamped / 100})`;
    onProgress(clamped / 100);
  };

  const finish = () => {
    if (finished) return;
    finished = true;

    window.setTimeout(() => {
      if (reducedMotion.matches) {
        root.remove();
        onDone();
        return;
      }

      gsap.to(root, {
        clipPath: "inset(0 0 100% 0)",
        duration: 1,
        ease: "expoOut",
        onComplete: () => {
          root.remove();
          onDone();
        },
      });
    }, 260);
  };

  commit(0);

  if (reducedMotion.matches) {
    commit(100);
    finish();
    return;
  }

  const progress = { value: 0 };

  gsap.to(progress, {
    value: 100,
    duration: 2.25,
    ease: "power2.inOut",
    onUpdate: () => commit(progress.value),
    onComplete: finish,
  });
}
