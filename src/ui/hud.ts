import { gsap, isCoarsePointer, reducedMotion } from "../lib/motion";
import { meanRiskAtDay } from "./routes";
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

/**
 * The storm chapter's numbers are readouts, not statistics: every value is
 * derived from `choreo.day`, which the day rail rewrites as the page scrolls.
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

  const tick = () => {
    const uDay = window.__meridian?.choreo?.uDay ?? 0;
    const spread = Math.pow(1 - uDay, 1.2);

    // Hero day (14 → 0)
    const heroDayEl = document.getElementById("hero-day");
    const heroDayUnit = document.getElementById("hero-day-unit");
    if (heroDayEl) heroDayEl.textContent = String(Math.min(14, Math.max(0, Math.round(window.__meridian?.choreo?.day ?? 14))));
    if (heroDayUnit) {
      const hv = Math.min(14, Math.max(0, Math.round(window.__meridian?.choreo?.day ?? 14)));
      heroDayUnit.textContent = hv === 1 ? "Day" : "Days";
    }

    // Hero spread (scroll-based)
    const heroSpreadEl = document.getElementById("ensemble-spread");
    if (heroSpreadEl) heroSpreadEl.textContent = `Spread ${Math.pow(1 - Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight * 0.9))), 1.2).toFixed(2)}`;

    // Day stamp (D11, D10, etc.)
    const dayEl = document.querySelector<HTMLElement>('[data-hud="day"]');
    if (dayEl) dayEl.textContent = `D${String(Math.round(Math.min(14, Math.max(0, window.__meridian?.choreo?.day ?? 14)))).padStart(2, "0")}`;

    // Lead time
    const leadEl = document.querySelector<HTMLElement>('[data-hud="lead"]');
    if (leadEl) leadEl.textContent = String(Math.round(Math.min(14, Math.max(0, window.__meridian?.choreo?.day ?? 14))));

    // Spread label (storm HUD)
    const spread = Math.pow(1 - (window.__meridian?.choreo?.uDay ?? 0), 1.2);
    const spreadLabelEl = document.querySelector<HTMLElement>('[data-hud="spread-label"]');
    if (spreadLabelEl) spreadLabelEl.textContent = `Spread ${spread.toFixed(2)}`;

    // Risk (storm field %)
    const dayForRisk = Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11));
    const risk = meanRiskAtDay(dayForRisk);
    const riskEl = document.querySelector<HTMLElement>('[data-hud="risk"]');
    if (riskEl) riskEl.textContent = `${Math.round(risk)}%`;
    const meter = document.querySelector<HTMLElement>("[data-hud-bar]");
    if (meter) meter.style.setProperty("transform", `scaleX(${meanRiskAtDay(Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11))) / 100})`);

    // Assets exposed
    const riskVal = meanRiskAtDay(Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11)));
    const exposed = Math.round((38412 * riskVal) / 100);
    const exposedEl = document.querySelector<HTMLElement>('[data-hud="exposed"]');
    if (exposedEl) exposedEl.textContent = exposed.toLocaleString("en-US");

    // Recall
    const dayForRisk2 = Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11));
    const recall = Math.round(92 - (dayForRisk2 - 8) * 1.5);
    const recallEl = document.querySelector<HTMLElement>('[data-hud="recall"]');
    if (recallEl) recallEl.textContent = String(recall);

    // Bar fills
    const dayVal = Math.min(14, Math.max(0, window.__meridian?.choreo?.day ?? 14));
    const riskVal = meanRiskAtDay(Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11)));
    const barLead = document.querySelector<HTMLElement>('[data-hud-bar-lead]');
    if (barLead) barLead.style.setProperty("--value", String((14 - dayVal) / 14));
    const barAssets = document.queryselector<HTMLElement>('[data-hud-bar-assets]');
    if (barAssets) barAssets.style.setProperty("--value", String(riskVal / 100));
    const barRecall = document.querySelector<HTMLElement>('[data-hud-bar-recall]');
    if (barRecall) {
      const dayForRisk2 = Math.min(11, Math.max(8, window.__meridian?.choreo?.day ?? 11));
      const recall = Math.round(92 - (dayForRisk2 - 8) * 1.5);
      barRecall.style.setProperty("--value", String(recall / 100));
    }

    // Members (constant 51)
    const membersEl = document.querySelector<HTMLElement>('[data-hud="members"]');
    if (membersEl) membersEl.textContent = "51";

    // Spread label
    const spread = Math.pow(1 - (window.__meridian?.choreo?.uDay ?? 0), 1.2);
    const spreadLabelEl = document.querySelector<HTMLElement>('[data-hud="spread-label"]');
    if (spreadLabelEl) spreadLabelEl.textContent = `Spread ${spread.toFixed(2)}`;

    // Sentence reveal by day
    const sentenceEls = [
      document.querySelector<HTMLElement>('[data-sentence="0"]'),
      document.querySelector<HTMLElement>('[data-sentence="1"]'),
      document.querySelector<HTMLElement>('[data-sentence="2"]'),
    ];
    for (let i = 0; i < 3; i++) {
      const el = sentenceEls[i];
      if (!el) continue;
      const threshold = [10.7, 9.9, 9.1][i];
      const dayVal = window.__meridian?.choreo?.day ?? 14;
      const t = (threshold - dayVal) / 0.7;
      const progress = Math.min(1, Math.max(0, t));
      el.style.opacity = String(0.12 + 0.88 * progress);
      el.style.transform = `translateY(${10 * (1 - progress)}px)`;
    }

    // HUD attachment to storm (desktop)
    if (window.innerWidth > 720 && window.__meridian?.scene) {
      const scene = window.__meridian.scene;
      if (scene && typeof scene.getStormScreenPoint === "function") {
        const pt = scene.getStormScreenPoint();
        if (pt) {
          const topPct = Math.max(56, Math.min(72, pt.y * 100 + 10));
          document.documentElement.style.setProperty("--storm-hud-top", `${topPct}%`);
        }
      }
    }
  };

  gsap.ticker.add(tick);
}