/**
 * Shared scroll-to-camera state. `state` is a continuous 0–2 value:
 * 0 = hero orbit, 1 = storm close-up, 2 = shipping-lane pull-out.
 * `veil` (0–1) fades the planet down to a star field once editorial
 * content takes over after the lane view; `pricing` (0–1) raises the
 * liquid plan-field shader. ScrollTrigger writes all three; the scene reads.
 */

export const choreo = { state: 0, veil: 0, pricing: 0 };

export const clampState = (value: number) =>
  Math.min(2, Math.max(0, value));

export function stormWeightOf(state: number): number {
  return Math.max(0, 1 - Math.abs(clampState(state) - 1) / 0.55);
}

export function routesWeightOf(state: number): number {
  return Math.min(1, Math.max(0, (clampState(state) - 1.15) / 0.7));
}
