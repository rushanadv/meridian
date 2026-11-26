import { gsap, ScrollTrigger, reducedMotion } from "../lib/motion";
import { choreo } from "../lib/choreography";

interface RouteTiming {
  etaHours: [number, number];
  cost: [number, number];
}

interface RouteDatum {
  code: string;
  name: string;
  spoken: string;
  values: number[];
  current: number;
  timing: RouteTiming;
}

interface RoutesPanelOptions {
  onSelect: (index: number) => void;
  onReplay?: () => void;
}

const ROUTES: RouteDatum[] = [
  {
    code: "R1",
    name: "Shanghai → Rotterdam",
    spoken: "Shanghai to Rotterdam",
    values: [18, 21, 24, 27, 30, 34, 42, 51, 58, 49, 39, 31, 27, 24, 22],
    current: 5,
    timing: { etaHours: [438, 490], cost: [214800, 261600] },
  },
  {
    code: "R2",
    name: "Singapore → Los Angeles",
    spoken: "Singapore to Los Angeles",
    values: [44, 48, 55, 61, 66, 72, 68, 61, 55, 52, 48, 44, 41, 39, 37],
    current: 3,
    timing: { etaHours: [530, 584], cost: [188400, 241900] },
  },
  {
    code: "R3",
    name: "Santos → Shanghai",
    spoken: "Santos to Shanghai",
    values: [30, 33, 36, 40, 45, 52, 57, 61, 55, 48, 42, 38, 35, 32, 30],
    current: 5,
    timing: { etaHours: [638, 684], cost: [246100, 289700] },
  },
];

const CHART = { left: 10, right: 292, top: 12, bottom: 112 };
const LANE_DAY_START = 7;
const LANE_DAY_END = 4;

export const TRACKED_ASSETS = 38412;

/** Mean lane risk across the three demo lanes on a given forecast day. */
export function meanRiskAtDay(day: number): number {
  const index = Math.min(14, Math.max(0, Math.round(day)));
  const values = ROUTES.map((route) => route.values[index] ?? 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const dayLabel = (index: number) => String(index).padStart(2, "0");

const xAt = (point: number) =>
  CHART.left + (point / 14) * (CHART.right - CHART.left);

const yAt = (risk: number) =>
  CHART.bottom - (risk / 100) * (CHART.bottom - CHART.top);

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const spreadAt = (index: number) => 4 + 13 * (index / 14);

function buildGrid(): void {
  const grid = document.getElementById("chart-grid");
  const axis = document.getElementById("chart-axis");
  if (!grid) return;

  const namespace = "http://www.w3.org/2000/svg";

  for (const risk of [25, 50, 75]) {
    const line = document.createElementNS(namespace, "line");
    line.setAttribute("x1", String(CHART.left));
    line.setAttribute("x2", String(CHART.right));
    line.setAttribute("y1", String(yAt(risk)));
    line.setAttribute("y2", String(yAt(risk)));
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "0.75");
    line.setAttribute("opacity", "0.55");
    grid.append(line);
  }

  for (const day of [0, 7, 14]) {
    const line = document.createElementNS(namespace, "line");
    line.setAttribute("x1", String(xAt(day)));
    line.setAttribute("x2", String(xAt(day)));
    line.setAttribute("y1", String(CHART.top));
    line.setAttribute("y2", String(CHART.bottom));
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "0.6");
    line.setAttribute("opacity", day === 7 ? "0.35" : "0.55");
    grid.append(line);
  }

  if (!axis) return;

  for (const day of [0, 3, 7, 10, 14]) {
    const label = document.createElementNS(namespace, "text");
    label.setAttribute("x", String(xAt(day)));
    label.setAttribute("y", "126");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "routes__chart-axis-label");
    label.textContent = `D${dayLabel(day)}`;
    axis.append(label);
  }
}

function pathFor(values: number[]): string {
  return values
    .map((value, index) => {
      const command = index === 0 ? "M" : "L";
      return `${command}${xAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`;
    })
    .join(" ");
}

function areaPathFor(values: number[]): string {
  const last = values.length - 1;
  return `M${xAt(0)} ${CHART.bottom} ${values
    .map((value, index) => `L${xAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`)
    .join(" ")} L${xAt(last)} ${CHART.bottom} Z`;
}

/** P10–P90 uncertainty ribbon: widens as the horizon reaches out. */
function bandPathFor(values: number[]): string {
  const high: string[] = [];
  const low: string[] = [];

  values.forEach((value, index) => {
    const spread = spreadAt(index);
    const upper = Math.min(98, value + spread);
    const lower = Math.max(2, value - spread);
    high.push(`${xAt(index).toFixed(2)} ${yAt(upper).toFixed(2)}`);
    low.push(`${xAt(index).toFixed(2)} ${yAt(lower).toFixed(2)}`);
  });

  return `M${high[0]} ${high.slice(1).map((p) => `L${p}`).join(" ")} L${
    low[low.length - 1]
  } ${low
    .slice(0, -1)
    .reverse()
    .map((p) => `L${p}`)
    .join(" ")} Z`;
}

export function initRoutesPanel({ onSelect, onReplay }: RoutesPanelOptions): void {
  const rows = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-route]"),
  );
  const chart = document.getElementById("risk-chart");
  const line = document.getElementById("chart-line");
  const area = document.getElementById("chart-area-path");
  const band = document.getElementById("chart-band");
  const clip = document.getElementById("chart-clip");
  const nowDot = document.getElementById("chart-now");
  const nowLine = document.getElementById("chart-now-line");
  const nowLabel = document.getElementById("chart-now-label");
  const peakDot = document.getElementById("chart-peak");
  const peakLabel = document.getElementById("chart-peak-label");
  const riskOut = document.getElementById("chart-risk");
  const whenOut = document.getElementById("chart-when");
  const routeOut = document.getElementById("chart-route");
  const peakOut = document.getElementById("chart-peak-value");
  const peakDayOut = document.getElementById("chart-peak-day");
  const announce = document.getElementById("chart-announce");
  const title = document.getElementById("risk-chart-title");

  const etaValue = document.getElementById("eta-value");
  const costValue = document.getElementById("cost-value");
  const etaNote = document.getElementById("eta-note");
  const costNote = document.getElementById("cost-note");
  const replay = document.getElementById("lane-replay");

  const scrubTrack = document.getElementById("lane-day");
  const scrubFill = document.querySelector<HTMLElement>(".routes__scrub-fill");
  const scrubHandle = document.querySelector<HTMLElement>(".routes__scrub-handle");
  const dayOut = document.getElementById("lane-day-out");

  const stepButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-step]"),
  );

  if (
    rows.length === 0 ||
    !chart ||
    !line ||
    !area ||
    !band ||
    !clip ||
    !nowDot ||
    !nowLine ||
    !nowLabel ||
    !peakDot ||
    !peakLabel ||
    !riskOut ||
    !whenOut ||
    !routeOut ||
    !peakOut ||
    !peakDayOut ||
    !announce ||
    !title
  ) {
    return;
  }

  buildGrid();

  rows.forEach((row, index) => {
    const datum = ROUTES[index];
    if (!datum) return;

    const currentRisk = datum.values[datum.current] ?? 0;
    const peak = Math.max(...datum.values);
    const risk = row.querySelector<HTMLElement>(".routes__risk");

    if (risk) {
      risk.textContent = `Now ${currentRisk}% · peak ${peak}%`;
    }
  });

  const animate = !reducedMotion.matches;
  let selected = -1;
  const riskProxy = { value: 0 };
  let displayBend = 0;
  let isDragging = false;
  let replaying = false;

  const formatEta = (hours: number) => {
    const rounded = Math.round(hours);
    const days = Math.floor(rounded / 24);
    const rest = rounded % 24;
    return `+${days}d ${rest}h`;
  };

  const paintCounters = () => {
    const datum = ROUTES[selected];
    if (!datum) return;

    const etaDelta = (datum.timing.etaHours[1] - datum.timing.etaHours[0]) * displayBend;
    const costDelta = (datum.timing.cost[1] - datum.timing.cost[0]) * displayBend;

    if (etaValue) etaValue.textContent = formatEta(etaDelta);
    if (costValue) {
      costValue.textContent = `+$${Math.round(costDelta).toLocaleString("en-US")}`;
    }
    if (etaNote) {
      etaNote.textContent =
        displayBend > 0.02 ? "member 17 detour" : "moves with member 17";
    }
    if (costNote) {
      costNote.textContent =
        displayBend > 0.02 ? "rerouted charter" : "before the bend";
    }
  };

  const paintRisk = () => {
    riskOut.textContent = String(Math.round(riskProxy.value));
  };

  const select = (index: number, moveFocus: boolean): void => {
    const datum = ROUTES[index];
    if (!datum) return;

    const previous = selected >= 0 ? ROUTES[selected] : null;
    selected = index;

    rows.forEach((row, rowIndex) => {
      const active = rowIndex === index;
      row.classList.toggle("is-active", active);
      row.setAttribute("aria-pressed", String(active));
    });

    if (moveFocus) rows[index]?.focus({ preventScroll: true });
    onSelect(index);

    const peak = Math.max(...datum.values);
    const peakIndex = datum.values.indexOf(peak);
    const currentRisk = datum.values[datum.current] ?? 0;
    const nowX = xAt(datum.current);
    const nowY = yAt(currentRisk);
    const peakX = xAt(peakIndex);
    const peakY = yAt(peak);

    line.setAttribute("d", pathFor(datum.values));
    area.setAttribute("d", areaPathFor(datum.values));
    band.setAttribute("d", bandPathFor(datum.values));
    peakDot.setAttribute("cx", String(peakX));
    peakDot.setAttribute("cy", String(peakY));
    peakLabel.setAttribute("x", String(peakX + (peakX > 220 ? -6 : 6)));
    peakLabel.setAttribute(
      "y",
      String(Math.max(10, peakY - 7)),
    );
    peakLabel.setAttribute(
      "text-anchor",
      peakX > 220 ? "end" : "start",
    );

    nowLine.setAttribute("x1", String(nowX));
    nowLine.setAttribute("x2", String(nowX));
    nowDot.setAttribute("cx", String(nowX));
    nowDot.setAttribute("cy", String(nowY));
    nowLabel.setAttribute("x", String(nowX + 5));
    nowLabel.setAttribute("y", String(Math.min(CHART.bottom - 2, nowY + 9)));
    nowLabel.setAttribute("text-anchor", "start");

    routeOut.textContent = datum.name;
    peakOut.textContent = `${peak}%`;
    peakDayOut.textContent = `· DAY ${dayLabel(peakIndex)}`;
    whenOut.textContent = `NOW · DAY ${dayLabel(datum.current)}`;
    title.textContent = `${datum.spoken} risk is ${currentRisk} percent now and peaks at ${peak} percent on day ${peakIndex}.`;
    announce.textContent = `${datum.spoken}: ${currentRisk} percent risk now, peaking at ${peak} percent on day ${peakIndex} of fourteen.`;

    const fromRisk = previous
      ? previous.values[previous.current] ?? 0
      : animate
        ? 0
        : currentRisk;

    gsap.killTweensOf(riskProxy);
    riskProxy.value = fromRisk;

    paintCounters();

    if (animate) {
      gsap.to(riskProxy, {
        value: currentRisk,
        duration: 0.75,
        ease: "power4.out",
        overwrite: true,
        onUpdate: paintRisk,
      });
    } else {
      riskProxy.value = currentRisk;
      paintRisk();
    }

    if (animate) {
      gsap.fromTo(
        clip,
        { attr: { width: 0 } },
        { attr: { width: 300 }, duration: 0.9, ease: "power4.out" },
      );
      gsap.fromTo(
        nowDot,
        {
          attr: {
            cx: previous ? xAt(previous.current) : nowX,
            cy: previous ? yAt(previous.values[previous.current] ?? 0) : nowY,
          },
        },
        { attr: { cx: nowX, cy: nowY }, duration: 0.7, ease: "power4.out" },
      );
      gsap.fromTo(
        peakDot,
        { opacity: 0 },
        { opacity: 0.75, duration: 0.5, delay: 0.35, ease: "power2.out" },
      );
    } else {
      gsap.set(clip, { attr: { width: 300 } });
      nowDot.setAttribute("cx", String(nowX));
      nowDot.setAttribute("cy", String(nowY));
      peakDot.setAttribute("opacity", "0.75");
    }
  };

  rows.forEach((row, index) => {
    row.addEventListener("click", () => select(index, false));
    row.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const next = (index + direction + rows.length) % rows.length;
      select(next, true);
    });
  });

  // ---- The pinned lane run: Ingest → Resolve → Reroute -------------------

  const section = document.getElementById("routes");
  const captions = Array.from(
    document.querySelectorAll<HTMLElement>("[data-caption]"),
  );
  const status = document.getElementById("routes-caption-status");

  const setCaption = (index: number, announce = false): void => {
    const clamped = Math.max(0, Math.min(captions.length - 1, index));

    captions.forEach((caption, captionIndex) => {
      caption.classList.toggle("is-active", captionIndex === clamped);
    });
    stepButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === clamped;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });

    if (announce && status) {
      const num = captions[clamped]
        .querySelector(".routes__caption-num")
        ?.textContent?.trim();
      const titleText = captions[clamped]
        .querySelector(".routes__caption-title")
        ?.textContent?.trim();
      status.textContent = [num, titleText].filter(Boolean).join(". ");
    }
  };

  let laneProgress = 0;

  const paintScrub = (progress: number): void => {
    const clamped = Math.min(1, Math.max(0, progress));
    const day = LANE_DAY_START - clamped * (LANE_DAY_START - LANE_DAY_END);
    const rounded = Math.round(day);

    if (scrubFill) scrubFill.style.width = `${clamped * 100}%`;
    if (scrubHandle) scrubHandle.style.left = `${clamped * 100}%`;
    if (dayOut) dayOut.textContent = `D${dayLabel(rounded)}`;
    if (scrubTrack) {
      scrubTrack.setAttribute("aria-valuenow", String(rounded));
      scrubTrack.setAttribute(
        "aria-valuetext",
        `${rounded} ${rounded === 1 ? "day" : "days"} to impact`,
      );
    }

    const step = clamped < 0.34 ? 0 : clamped < 0.67 ? 1 : 2;
    setCaption(step);

    const reroute = smoothstep(0.64, 0.97, clamped);
    choreo.lanes = clamped;
    choreo.reroute = reroute;

    if (!replaying) {
      displayBend = reroute;
      paintCounters();
    }
  };

  const applyProgress = (progress: number): void => {
    laneProgress = Math.min(1, Math.max(0, progress));
    paintScrub(laneProgress);
  };

  const scrubTo = (progress: number): void => {
    applyProgress(progress);
  };

  const progressFromClientX = (clientX: number): number => {
    if (!scrubTrack) return laneProgress;
    const rect = scrubTrack.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  if (scrubTrack) {
    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      scrubTrack.setPointerCapture(event.pointerId);
      scrubTo(progressFromClientX(event.clientX));
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      scrubTo(progressFromClientX(event.clientX));
    };

    const onPointerUp = (event: PointerEvent) => {
      isDragging = false;
      if (scrubTrack.hasPointerCapture(event.pointerId)) {
        scrubTrack.releasePointerCapture(event.pointerId);
      }
    };

    scrubTrack.addEventListener("pointerdown", onPointerDown);
    scrubTrack.addEventListener("pointermove", onPointerMove);
    scrubTrack.addEventListener("pointerup", onPointerUp);
    scrubTrack.addEventListener("pointercancel", onPointerUp);

    scrubTrack.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 0.25
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -0.25
          : 0;

      if (event.key === "Home") {
        event.preventDefault();
        scrubTo(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        scrubTo(1);
        return;
      }
      if (step === 0) return;

      event.preventDefault();
      scrubTo(Math.min(1, Math.max(0, laneProgress + step)));
    });
  }

  stepButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      scrubTo(index === 0 ? 0 : index === 1 ? 0.5 : 1);
    });
  });

  if (replay) {
    replay.addEventListener("click", () => {
      if (!animate) {
        scrubTo(1);
        return;
      }

      replaying = true;
      // Jump to the full bend so replay ends on the resolved passage rather
      // than snapping back to a half-scrubbed state.
      scrubTo(1);
      displayBend = 0;
      paintCounters();
      onReplay?.();

      const proxy = { value: 0 };
      gsap.to(proxy, {
        value: 1,
        duration: 1.6,
        ease: "power2.inOut",
        onUpdate: () => {
          displayBend = proxy.value;
          paintCounters();
        },
        onComplete: () => {
          replaying = false;
        },
      });

      if (status) {
        status.textContent =
          "Replaying the member 17 bend: the old passage ghosts and the detour redraws.";
      }
    });
  }

  select(0, false);
  paintScrub(0);

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    if (!section) return;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * 2.2)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (isDragging) return;
        applyProgress(self.progress);
      },
    });

    return () => {
      trigger.kill();
      choreo.lanes = 0;
      choreo.reroute = 0;
      setCaption(0);
    };
  });
}
