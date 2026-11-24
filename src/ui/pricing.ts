interface PricingOptions {
  onHover: (active: boolean) => void;
}

export function initPricing({ onHover }: PricingOptions): void {
  const tiers = Array.from(
    document.querySelectorAll<HTMLElement>("[data-pricing-tier]"),
  );

  for (const tier of tiers) {
    const enter = () => onHover(true);
    const leave = () => onHover(false);

    tier.addEventListener("pointerenter", enter);
    tier.addEventListener("pointerleave", leave);
    tier.addEventListener("focusin", enter);
    tier.addEventListener("focusout", leave);
  }
}
