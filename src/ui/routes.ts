import { gsap, ScrollTrigger, reducedMotion } from "../lib/motion";

interface RouteDatum {
  code: string;
  name: string;
  spoken: string;
  values: number[];
  current: number;
}

interface RoutesPanelOptions {
  onSelect: (index: number) => void;
}

const ROUTES: RouteDatum[] = [
  {
    code: "R1",
    name: "Shanghai → Rotterdam",
    spoken: "Shanghai to Rotterdam",
    values: [18, 21, 24, 27, 30, 34, 42, 51, 58, 49, 39, 31, 27, 24, 22],
    current: 5,
  },
  {
    code: "R2",
    name: "Singapore → Los Angeles",
    spoken: "Singapore to Los Angeles",
    values: [44, 48, 55, 61, 66, 72, 68, 61, 55, 52, 48, 44, 41, 39, 37],
    current: 3,
  },
  {
    code: "R3",
    name: "Santos → Shanghai",
    spoken: "Santos to Shanghai",
    values: [30, 33, 36, 40, 45, 52, 57, 61, 55, 48, 42, 38, 35, 32, 30],
    current: 5,
  },
];

const CHART = { left: 10, right: 292, top: 12, bottom: 112 };

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

function buildGrid(): void {
  const grid = document.getElementById("chart-grid");
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
    line.setAttribute("opacity", "0.65");
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
    line.setAttribute("opacity", day === 7 ? "0.4" : "0.65");
    grid.append(line);
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

export function initRoutesPanel({ onSelect }: RoutesPanelOptions): void {
  const rows = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-route]"),
  );
  const chart = document.getElementById("risk-chart");
  const line = document.getElementById("chart-line");
  const area = document.getElementById("chart-area-path");
  const clip = document.getElementById("chart-clip");
  const nowDot = document.getElementById("chart-now");
  const nowLine = document.getElementById("chart-now-line");
  const peakDot = document.getElementById("chart-peak");
  const riskOut = document.getElementById("chart-risk");
  const whenOut = document.getElementById("chart-when");
  const routeOut = document.getElementById("chart-route");
  const peakOut = document.getElementById("chart-peak-value");
  const peakDayOut = document.getElementById("chart-peak-day");
  const announce = document.getElementById("chart-announce");
  const title = document.getElementById("risk-chart-title");

  if (
    rows.length === 0 ||
    !chart ||
    !line ||
    !area ||
    !clip ||
    !nowDot ||
    !nowLine ||
    !peakDot ||
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
    peakDot.setAttribute("cx", String(peakX));
    peakDot.setAttribute("cy", String(peakY));

    nowLine.setAttribute("x1", String(nowX));
    nowLine.setAttribute("x2", String(nowX));

    routeOut.textContent = datum.name;
    peakOut.textContent = `${peak}%`;
    peakDayOut.textContent = `/ DAY ${dayLabel(peakIndex)}`;
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
        { attr: { cx: previous ? xAt(previous.current) : nowX, cy: previous ? yAt(previous.values[previous.current] ?? 0) : nowY } },
        { attr: { cx: nowX, cy: nowY }, duration: 0.7, ease: "power4.out" },
      );
      gsap.fromTo(
        peakDot,
        { opacity: 0 },
        { opacity: 0.7, duration: 0.5, delay: 0.35, ease: "power2.out" },
      );
    } else {
      gsap.set(clip, { attr: { width: 300 } });
      nowDot.setAttribute("cx", String(nowX));
      nowDot.setAttribute("cy", String(nowY));
      peakDot.setAttribute("opacity", "0.7");
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

  select(0, false);
  initLanesScroll();
}

/**
 * Pin the lane instrument while the three process captions swap with scroll.
 * The pin is the only place the three moves are read, so the chapter stays
 * one instrument rather than three stacked cards.
 */
function initLanesScroll(): void {
  const section = document.getElementById("routes");
  const captions = Array.from(
    document.querySelectorAll<HTMLElement>("[data-caption]"),
  );
  const status = document.getElementById("routes-caption-status");

  if (!section || captions.length === 0) return;

  let current = -1;

  const setCaption = (index: number, announce = false): void => {
    const clamped = Math.max(0, Math.min(captions.length - 1, index));
    if (clamped === current) return;
    current = clamped;

    captions.forEach((caption, captionIndex) => {
      caption.classList.toggle("is-active", captionIndex === clamped);
    });

    if (announce && status) {
      const num = captions[clamped]
        .querySelector(".routes__caption-num")
        ?.textContent?.trim();
      const title = captions[clamped]
        .querySelector(".routes__caption-title")
        ?.textContent?.trim();
      status.textContent = [num, title].filter(Boolean).join(". ");
    }
  };

  setCaption(0);

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${window.innerHeight * 0.9}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const index = self.progress < 0.4 ? 0 : self.progress < 0.73 ? 1 : 2;
        setCaption(index, true);
      },
    });

    return () => {
      trigger.kill();
      setCaption(0);
    };
  });
}
