import { gsap, finePointer, reducedMotion } from "./motion";

const MAX_OFFSET = 10;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

/**
 * Reusable magnetic-button pull. Pointer-fine only, film-safe, and bounded so
 * the control never feels detached from its own hit area.
 */
export function initMagnetic(): void {
  if (!finePointer.matches || reducedMotion.matches) return;

  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-magnetic]",
  )) {
    const moveX = gsap.quickTo(element, "x", {
      duration: 0.38,
      ease: "power3.out",
    });
    const moveY = gsap.quickTo(element, "y", {
      duration: 0.38,
      ease: "power3.out",
    });

    const reset = () => {
      moveX(0);
      moveY(0);
    };

    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      moveX(clamp(dx * 0.22, MAX_OFFSET));
      moveY(clamp(dy * 0.22, MAX_OFFSET));
    });

    element.addEventListener("pointerleave", reset);
    element.addEventListener("blur", reset);
  }
}
