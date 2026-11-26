import { gsap, isCoarsePointer, reducedMotion } from "../lib/motion";
import { meanRiskAtDay, TRACKED_ASSETS } from "./routes";
import type { MeridianScene } from "../webgl/Scene";

declare global {
  interface Window {
    __meridian?: {
      choreo: { state: number; veil: number; pricing: number; day: number; uDay: number };
      scene: MeridianScene | null;
      triggers: () => Array<{ target: string; start: number; end: number; progress: number }>;
    };
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const currentDay = () => clamp(window.__meridian?.choreo?.day ?? 14, 0, 14);

const stormRisk = () => meanRiskAtDay(clamp(currentDay(), 8, 11));

/**
 * The storm chapter's four figures are readouts, not statistics: horizon,
 * ensemble, exposed assets and recall all resolve from the current day on
 * the rail. The panel is projected off the scene so it stays tethered to the
 * cyclone instead of behaving like a detached card.
 */
export function initHud({ scene }: { scene: MeridianScene | null }): void {
  const stormHud = document.querySelector<HTMLElement>(".storm-hud");

  if (scene && stormHud) {
    const setHover = (active: boolean) => {
      scene.setStormHover(active);
      stormHud.classList.toggle("is-hover", active);
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        setHover(scene.isPointerNearStorm(event.clientX, event.clientY));
      },
      { passive: true },
    );

    document.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "touch") return;
      setHover(false);
    });

    if (isCoarsePointer && !reducedMotion.matches) {
      let tapTimer = 0;

      const tap = (clientX: number, clientY: number) => {
        if (!scene.isPointerNearStorm(clientX, clientY)) return;
        setHover(true);
        window.clearTimeout(tapTimer);
        tapTimer = window.setTimeout(() => setHover(false), 1600);
      };

      window.addEventListener(
        "pointerdown",
        (event) => tap(event.clientX, event.clientY),
        { passive: true },
      );

      window.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];
          if (touch) tap(touch.clientX, touch.clientY);
        },
        { passive: true },
      );
    }
  }

  const readout = <T extends HTMLElement>(selector: string) =>
    document.querySelector<T>(selector);

  const heroDayEl = readout<HTMLElement>("#hero-day");
  const heroDayUnit = readout<HTMLElement>("#hero-day-unit");
  const heroSpreadEl = readout<HTMLElement>("#ensemble-spread");
  const hudDayEl = readout<HTMLElement>('[data-hud="day"]');
  const hudDaySubEl = readout<HTMLElement>('[data-hud="day-sub"]');
  const remainingEl = readout<HTMLElement>('[data-hud="remaining"]');
  const membersEl = readout<HTMLElement>('[data-hud="members"]');
  const exposedEl = readout<HTMLElement>('[data-hud="exposed"]');
  const recallEl = readout<HTMLElement>('[data-hud="recall"]');
  const spreadLabelEl = readout<HTMLElement>('[data-hud="spread-label"]');
  const riskEl = readout<HTMLElement>('[data-hud="risk"]');
  const barLead = readout<HTMLElement>("[data-hud-bar-lead]");
  const barAssets = readout<HTMLElement>("[data-hud-bar-assets]");
  const barRecall = readout<HTMLElement>("[data-hud-bar-recall]");
  const sentenceEls = [0, 1, 2].map((index) =>
    readout<HTMLElement>(`[data-sentence="${index}"]`),
  );

  const tick = () => {
    const day = currentDay();
    const dayRounded = Math.round(day);
    const uDay = clamp(window.__meridian?.choreo?.uDay ?? 0, 0, 1);
    const spread = Math.pow(1 - uDay, 1.2);
    const risk = stormRisk();
    const recall = Math.round(92 - (clamp(day, 8, 11) - 8) * 1.5);
    const exposed = Math.round((TRACKED_ASSETS * risk) / 100);

    if (heroDayEl) heroDayEl.textContent = String(dayRounded);
    if (heroDayUnit) heroDayUnit.textContent = dayRounded === 1 ? "Day" : "Days";
    if (heroSpreadEl) {
      const heroScroll = clamp(
        window.scrollY / Math.max(1, window.innerHeight * 0.9),
        0,
        1,
      );
      heroSpreadEl.textContent = `Spread ${Math.pow(1 - heroScroll, 1.2).toFixed(2)}`;
    }

    const dayStamp = `D${String(dayRounded).padStart(2, "0")}`;
    if (hudDayEl) hudDayEl.textContent = dayStamp;
    if (hudDaySubEl) hudDaySubEl.textContent = dayStamp;
    if (remainingEl) remainingEl.textContent = String(dayRounded);
    if (membersEl) membersEl.textContent = "51";
    if (exposedEl) exposedEl.textContent = exposed.toLocaleString("en-US");
    if (recallEl) recallEl.textContent = String(recall);
    if (spreadLabelEl) spreadLabelEl.textContent = `Spread ${spread.toFixed(2)}`;
    if (riskEl) riskEl.textContent = `${Math.round(risk)}%`;

    if (barLead) barLead.style.setProperty("--value", String(day / 14));
    if (barAssets) barAssets.style.setProperty("--value", String(risk / 100));
    if (barRecall) barRecall.style.setProperty("--value", String(recall / 100));

    const thresholds = [11.7, 10.5, 9.9];
    for (let index = 0; index < sentenceEls.length; index += 1) {
      const el = sentenceEls[index];
      if (!el) continue;
      const progress = clamp((thresholds[index] - day) / 0.7, 0, 1);
      el.style.opacity = String(progress);
      el.style.transform = `translateY(${10 * (1 - progress)}px)`;
    }

    if (window.innerWidth > 720 && scene) {
      const point = scene.getStormScreenPoint();
      if (point) {
        const top = clamp(56, Math.min(72, point.y * 100 + 10), 72);
        document.documentElement.style.setProperty("--storm-hud-top", `${top}%`);
      }
    }
  };

  gsap.ticker.add(tick);
}
