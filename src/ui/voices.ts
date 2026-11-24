import { gsap, reducedMotion } from "../lib/motion";
import type { ScrollController } from "../lib/scroll";

const pad = (value: number) => String(value).padStart(2, "0");
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function initVoices(scroll: ScrollController): void {
  const viewport = document.getElementById("voices-viewport");
  const track = document.getElementById("voices-track");
  const prev = document.querySelector<HTMLButtonElement>("[data-voice-prev]");
  const next = document.querySelector<HTMLButtonElement>("[data-voice-next]");
  const count = document.getElementById("voices-count");
  const announce = document.getElementById("voices-announce");
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>(".voices__card"),
  );

  if (!viewport || !track || cards.length === 0) return;

  let index = 0;
  let x = 0;
  let step = 0;
  let maxX = 0;
  let dragging = false;
  let startX = 0;
  let startTrack = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let pointerId = -1;

  const measure = () => {
    maxX = Math.max(0, track.scrollWidth - viewport.clientWidth);
    step = cards.length > 1 ? maxX / (cards.length - 1) : 0;
  };

  const updateLabels = () => {
    if (count) {
      count.textContent = `${pad(index + 1)} / ${pad(cards.length)}`;
    }

    if (prev) prev.disabled = index === 0;
    if (next) next.disabled = index === cards.length - 1;

    if (announce) {
      const name = cards[index].querySelector(".voices__name")?.textContent;
      announce.textContent = `Note ${index + 1} of ${cards.length}${name ? `, ${name}` : ""}.`;
    }
  };

  const goTo = (targetIndex: number, animate = true): void => {
    index = clamp(targetIndex, 0, cards.length - 1);
    const target = -Math.min(index * step, maxX);
    x = target;

    gsap.killTweensOf(track);

    if (animate && !reducedMotion.matches) {
      gsap.to(track, {
        x: target,
        duration: 0.85,
        ease: "power4.out",
      });
    } else {
      gsap.set(track, { x: target });
    }

    updateLabels();
  };

  const press = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;

    dragging = true;
    pointerId = event.pointerId;
    velocity = 0;
    startX = event.clientX;
    lastX = event.clientX;
    lastTime = performance.now();
    startTrack = Number(gsap.getProperty(track, "x")) || 0;
    x = startTrack;

    gsap.killTweensOf(track);
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
    scroll.stop();
    event.preventDefault();
  };

  const move = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return;

    const now = performance.now();
    const dx = event.clientX - startX;
    let raw = startTrack + dx;

    if (raw > 0) raw *= 0.32;
    else if (raw < -maxX) raw = -maxX + (raw + maxX) * 0.32;

    const instant = (event.clientX - lastX) / Math.max(1, now - lastTime);
    velocity = velocity * 0.7 + instant * 0.3;
    lastX = event.clientX;
    lastTime = now;
    x = raw;

    gsap.set(track, { x: raw });
  };

  const release = (event: PointerEvent) => {
    if (!dragging || event.pointerId !== pointerId) return;

    dragging = false;
    pointerId = -1;
    viewport.classList.remove("is-dragging");

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    scroll.start();

    const momentum = reducedMotion.matches ? 0 : velocity * 190;
    const projected = clamp(x + momentum, -maxX, 0);
    const target = Math.round(-projected / step);

    goTo(target, !reducedMotion.matches);
  };

  const key = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    goTo(index + (event.key === "ArrowRight" ? 1 : -1));
  };

  viewport.addEventListener("pointerdown", press);
  viewport.addEventListener("pointermove", move);
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  viewport.addEventListener("keydown", key);
  viewport.addEventListener("dragstart", (event) => event.preventDefault());

  prev?.addEventListener("click", () => goTo(index - 1));
  next?.addEventListener("click", () => goTo(index + 1));

  const onResize = () => {
    measure();
    goTo(index, false);
  };

  window.addEventListener("resize", onResize, { passive: true });
  document.fonts.ready.then(onResize);

  measure();
  goTo(0, false);

  requestAnimationFrame(measure);
}
