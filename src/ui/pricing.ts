import { isCoarsePointer, reducedMotion } from "../lib/motion";

interface PricingOptions {
  onHover: (active: boolean) => void;
}

export function initPricing({ onHover }: PricingOptions): void {
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
