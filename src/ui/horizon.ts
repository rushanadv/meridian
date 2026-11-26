import { ScrollTrigger, isCoarsePointer, reducedMotion } from "../lib/motion";

interface HorizonOptions {
  onHover: (active: boolean) => void;
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * One quote line rotates as the horizon chapter scrolls; the four plans stay
 * put beneath it. No carousel, no controls — scroll is the only input.
 */
export function initHorizon({ onHover }: HorizonOptions): void {
  const section = document.getElementById("pricing");
  const quotes = Array.from(
    document.querySelectorAll<HTMLElement>("[data-quote]"),
  );
  const count = document.getElementById("horizon-quote-count");

  if (section && quotes.length > 0) {
    let current = -1;

    const activate = (index: number): void => {
      const clamped = Math.max(0, Math.min(quotes.length - 1, index));
      if (clamped === current) return;
      current = clamped;

      quotes.forEach((quote, quoteIndex) => {
        quote.classList.toggle("is-active", quoteIndex === clamped);
      });

      if (count) {
        count.textContent = `${pad(clamped + 1)} / ${pad(quotes.length)}`;
      }
    };

    activate(0);

    ScrollTrigger.create({
      trigger: section,
      start: "top 62%",
      end: "bottom 62%",
      onUpdate: (self) => {
        const index =
          self.progress < 0.55
            ? 0
            : self.progress < 0.75
              ? 1
              : self.progress < 0.9
                ? 2
                : 3;
        activate(Math.min(quotes.length - 1, index));
      },
    });
  }

  const tiers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-pricing-tier]"),
  );

  for (const tier of tiers) {
    const enter = () => onHover(true);
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      onHover(false);
    };

    tier.addEventListener("pointerenter", enter);
    tier.addEventListener("pointerleave", leave);
    tier.addEventListener("focusin", enter);
    tier.addEventListener("focusout", () => onHover(false));

    if (isCoarsePointer && !reducedMotion.matches) {
      let tapTimer = 0;

      const tap = () => {
        onHover(true);
        window.clearTimeout(tapTimer);
        tapTimer = window.setTimeout(() => onHover(false), 1400);
      };

      tier.addEventListener("pointerdown", tap, { passive: true });
      tier.addEventListener("touchstart", tap, { passive: true });
    }
  }
}