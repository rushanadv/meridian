import { ENSEMBLE_ORIGIN } from "../webgl/ensemble";
import type { MeridianScene } from "../webgl/Scene";

const formatCoordinate = (
  value: number,
  positive: string,
  negative: string,
): string => {
  const hemisphere = value >= 0 ? positive : negative;
  return `${Math.abs(value).toFixed(2)}°${hemisphere}`;
};

export const formatCoordinatePair = (lat: number, lon: number): string =>
  `${formatCoordinate(lat, "N", "S")} ${formatCoordinate(lon, "E", "W")}`;

export function initCoordinates(scene: MeridianScene | null): void {
  const origin = formatCoordinatePair(
    ENSEMBLE_ORIGIN.lat,
    ENSEMBLE_ORIGIN.lon,
  );

  document
    .querySelectorAll<HTMLElement>("[data-coord-origin]")
    .forEach((element) => {
      element.textContent = origin;
    });

  const readout = document.getElementById("coords");
  if (!readout) return;

  let lastLabel = origin;
  readout.textContent = lastLabel;

  if (!scene) return;

  window.addEventListener(
    "pointermove",
    (event) => {
      const coordinate = scene.getSurfaceCoordinate(
        event.clientX,
        event.clientY,
      );
      if (!coordinate) return;

      const label = formatCoordinatePair(coordinate.lat, coordinate.lon);
      if (label === lastLabel) return;

      readout.textContent = label;
      lastLabel = label;
    },
    { passive: true },
  );
}
