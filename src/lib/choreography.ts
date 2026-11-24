/**
 * Shared forecast and camera state. `state` is a continuous 0–2 value:
 * 0 = hero orbit, 1 = storm close-up, 2 = shipping-lane pull-out.
 * `veil` (0–1) fades the planet down to a star field once editorial
 * content takes over after the lane view; `pricing` (0–1) raises the
 * liquid plan-field shader. `day` is remaining forecast time (14–0) and
 * `uDay` normalises it to 0–1. ScrollTrigger and the day rail write these;
 * the scene and cursor read them.
 */

export const FORECAST_DAYS = 14;

export const choreo = {
  state: 0,
  veil: 0,
  pricing: 0,
  day: FORECAST_DAYS,
  uDay: 0,
};

export const clampState = (value: number) =>
  Math.min(2, Math.max(0, value));

export const dayToProgress = (day: number) =>
  Math.min(1, Math.max(0, (FORECAST_DAYS - day) / FORECAST_DAYS));

export function stormWeightOf(state: number): number {
  return Math.max(0, 1 - Math.abs(clampState(state) - 1) / 0.55);
}

export function routesWeightOf(state: number): number {
  return Math.min(1, Math.max(0, (clampState(state) - 1.15) / 0.7));
}
