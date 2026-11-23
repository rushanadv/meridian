/**
 * Shared scroll-to-camera state. `state` is a continuous 0–2 value:
 * 0 = hero orbit, 1 = storm close-up, 2 = shipping-lane pull-out.
 * ScrollTrigger writes it; the scene and HUD read it.
 */

export const choreo = { state: 0 };

export const clampState = (value: number) =>
  Math.min(2, Math.max(0, value));

export function stormWeightOf(state: number): number {
  return Math.max(0, 1 - Math.abs(clampState(state) - 1) / 0.55);
}

export function routesWeightOf(state: number): number {
  return Math.min(1, Math.max(0, (clampState(state) - 1.15) / 0.7));
}
