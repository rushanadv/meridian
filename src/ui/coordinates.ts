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

export interface ProbeReadout {
  /** Live surface coordinate under a screen point, or null when off-globe. */
  textAt: (clientX: number, clientY: number) => string | null;
}

/**
 * The globe is read as a probe, not an illustration: there are no printed
 * coordinates anywhere. Every readout shows the live local position under
 * the cursor and falls back to a non-coordinate idle label.
 */
export function initProbe(scene: MeridianScene | null): ProbeReadout {
  const readouts = Array.from(
    document.querySelectorAll<HTMLElement>("[data-probe]"),
  );

  const idleFor = (element: HTMLElement): string =>
    element.dataset.probeIdle ?? "MOVE OVER GLOBE";

  const showIdle = (): void => {
    for (const element of readouts) {
      const idle = idleFor(element);
      if (element.textContent !== idle) element.textContent = idle;
    }
  };

  const textAt = (clientX: number, clientY: number): string | null => {
    if (!scene) return null;
    const coordinate = scene.getSurfaceCoordinate(clientX, clientY);
    if (!coordinate) return null;
    return formatCoordinatePair(coordinate.lat, coordinate.lon);
  };

  showIdle();

  if (!scene) return { textAt: () => null };

  let last = "";

  window.addEventListener(
    "pointermove",
    (event) => {
      const live = textAt(event.clientX, event.clientY);

      if (!live) {
        if (last !== "") {
          last = "";
          showIdle();
        }
        return;
      }

      if (live === last) return;
      last = live;
      for (const element of readouts) element.textContent = live;
    },
    { passive: true },
  );

  return { textAt };
}