const RUN_INTERVAL_MS = 6 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, "0");

const utcTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

export function initForecastClock(): void {
  const nextRun = document.querySelector<HTMLElement>("[data-next-run]");
  const modelRun = document.querySelector<HTMLElement>("[data-model-run]");

  if (!nextRun && !modelRun) return;

  const tick = (): void => {
    const now = Date.now();
    const currentSlot = Math.floor(now / RUN_INTERVAL_MS) * RUN_INTERVAL_MS;

    if (modelRun) {
      modelRun.textContent = `Model run / ${utcTime(currentSlot)} UTC / 51 members`;
    }

    if (nextRun) {
      const remaining = currentSlot + RUN_INTERVAL_MS - now;
      const hours = Math.floor(remaining / 3_600_000);
      const minutes = Math.floor((remaining % 3_600_000) / 60_000);
      const seconds = Math.floor((remaining % 60_000) / 1000);

      nextRun.textContent = `NEXT RUN IN ${pad(hours)} H ${pad(minutes)} M ${pad(seconds)} S / 51 MEMBERS READY`;
    }
  };

  tick();
  const timer = window.setInterval(tick, 1000);

  window.addEventListener(
    "pagehide",
    () => window.clearInterval(timer),
    { once: true },
  );
}
