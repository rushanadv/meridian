import { finePointer, reducedMotion } from "../lib/motion";

export function initFooter(): void {
  const footer = document.getElementById("footer");
  const wordmark = document.getElementById("footer-wordmark");

  if (!footer || !wordmark || !finePointer.matches || reducedMotion.matches) {
    return;
  }

  const letters = Array.from(
    wordmark.querySelectorAll<HTMLElement>(".footer__letter"),
  );
  if (letters.length === 0) return;

  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let active = false;

  const reset = () => {
    for (const letter of letters) {
      letter.style.color = "transparent";
      letter.style.setProperty(
        "-webkit-text-stroke-color",
        "rgb(242 238 230 / 0.38)",
      );
      letter.style.transform = "translateY(0) scale(1)";
    }
  };

  const update = () => {
    frame = 0;
    if (!active) return;

    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.4;

    for (const letter of letters) {
      const rect = letter.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(pointerX - cx, pointerY - cy);
      const strength = Math.max(0, 1 - distance / radius);

      if (strength < 0.02) {
        letter.style.color = "transparent";
        letter.style.setProperty(
          "-webkit-text-stroke-color",
          "rgb(242 238 230 / 0.38)",
        );
        letter.style.transform = "translateY(0) scale(1)";
        continue;
      }

      letter.style.color = `rgba(127, 231, 255, ${(strength * 0.82).toFixed(3)})`;
      letter.style.setProperty(
        "-webkit-text-stroke-color",
        `rgba(127, 231, 255, ${(0.38 + strength * 0.58).toFixed(3)})`,
      );
      letter.style.transform = `translateY(${(-14 * strength).toFixed(2)}px) scale(${(
        1 + strength * 0.025
      ).toFixed(3)})`;
    }
  };

  const onMove = (event: PointerEvent) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    active = true;

    if (!frame) frame = requestAnimationFrame(update);
  };

  const onLeave = () => {
    active = false;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    reset();
  };

  footer.addEventListener("pointermove", onMove, { passive: true });
  footer.addEventListener("pointerleave", onLeave);
}
