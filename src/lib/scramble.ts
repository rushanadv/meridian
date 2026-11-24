import { finePointer, reducedMotion } from "./motion";

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789/#+-";

/**
 * Decorative hover scramble for short mono labels. The final string is mirrored
 * into aria-label so assistive tech never receives the transient glyphs.
 */
export function initScramble(): void {
  if (!finePointer.matches || reducedMotion.matches) return;

  for (const element of document.querySelectorAll<HTMLElement>(
    "[data-scramble]",
  )) {
    const text = element.textContent ?? "";
    if (!text.trim()) continue;

    element.setAttribute("aria-label", text);

    let frame = 0;

    const settle = () => {
      cancelAnimationFrame(frame);
      element.textContent = text;
    };

    element.addEventListener("pointerenter", () => {
      cancelAnimationFrame(frame);
      const started = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / 460);
        const revealed = Math.floor(progress * text.length);

        element.textContent = Array.from(text)
          .map((character, index) => {
            if (index < revealed || character === " ") return character;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "·";
          })
          .join("");

        if (progress < 1) {
          frame = requestAnimationFrame(step);
        } else {
          element.textContent = text;
        }
      };

      frame = requestAnimationFrame(step);
    });

    element.addEventListener("pointerleave", settle);
    element.addEventListener("blur", settle);
  }
}
