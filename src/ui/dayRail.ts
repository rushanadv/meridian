import { choreo, dayToProgress, FORECAST_DAYS } from "../lib/choreography";
import { CHAPTERS, chapterForDay, type ChapterConfig } from "../lib/sections";
import { reducedMotion, ScrollTrigger } from "../lib/motion";
import type { ScrollController } from "../lib/scroll";

interface TimelineSection {
  meta: ChapterConfig;
  element: HTMLElement;
  top: number;
  nextTop: number;
}

interface DayRailController {
  refresh: () => void;
  destroy: () => void;
}

const MAX_DAYS = FORECAST_DAYS;
const MOBILE_QUERY = window.matchMedia("(max-width: 720px)");

function formatDay(day: number): string {
  if (day === 0) return "Impact";
  return `${day} ${day === 1 ? "day" : "days"} to impact`;
}



export function initDayRail(
  scroll: ScrollController,
): DayRailController | null {
  const rail = document.getElementById("day-rail");
  if (!rail) return null;

  const readout = document.createElement("div");
  readout.className = "day-rail__readout";
  readout.setAttribute("aria-hidden", "true");

  const value = document.createElement("span");
  value.className = "day-rail__value";
  value.textContent = String(MAX_DAYS);

  const unit = document.createElement("span");
  unit.className = "day-rail__unit";
  unit.textContent = "days to impact";

  readout.append(value, unit);

  const nav = document.createElement("nav");
  nav.className = "day-rail__nav";
  nav.setAttribute("aria-label", "Days to impact");

  const links: HTMLElement[] = [];

  for (let day = MAX_DAYS; day >= 0; day -= 1) {
    const section = chapterForDay(day);
    const link = document.createElement("a");
    const label = formatDay(day);

    link.className = "day-rail__day";
    link.href = `#${section.id}`;
    link.dataset.day = String(day);
    link.dataset.section = section.id;
    link.dataset.cursor = "link";
    link.setAttribute(
      "aria-label",
      `${label}, ${section.label} chapter, days ${section.dayStart} to ${section.dayEnd}`,
    );

    if (day === section.dayStart) link.classList.add("is-chapter");

    const tick = document.createElement("span");
    tick.className = "day-rail__tick";
    tick.setAttribute("aria-hidden", "true");

    const number = document.createElement("span");
    number.className = "day-rail__number";
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(day);

    link.append(tick, number);
    nav.append(link);
    links.push(link);
  }

  const progress = document.createElement("span");
  progress.className = "day-rail__progress";
  progress.setAttribute("aria-hidden", "true");

  const fill = document.createElement("span");
  fill.className = "day-rail__fill";
  progress.append(fill);

  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("aria-live", "polite");

  rail.replaceChildren(readout, progress, nav, status);
  rail.style.setProperty("--rail-progress", "0");

  let timeline: TimelineSection[] = [];
  let currentDay = MAX_DAYS;
  let currentSectionId = "";
  let frame = 0;

  const chromeOffset = (): number => {
    const navHeight =
      document.getElementById("nav")?.getBoundingClientRect().height ?? 72;
    const railHeight = window.innerWidth <= 1279 ? 30 : 0;
    return navHeight + railHeight + 4;
  };

  const topOf = (element: HTMLElement): number => {
    const spacer = element.parentElement?.classList.contains("pin-spacer")
      ? element.parentElement
      : null;
    return (spacer ?? element).getBoundingClientRect().top + window.scrollY;
  };

  const measure = (): void => {
    timeline = CHAPTERS.map((meta) => {
      const element = document.getElementById(meta.id);
      if (!element) return null;

      return {
        meta,
        element,
        top: topOf(element),
        nextTop: 0,
      };
    }).filter((entry): entry is TimelineSection => entry !== null);

    if (timeline.length === 0) return;

    for (let index = 0; index < timeline.length; index += 1) {
      const entry = timeline[index];
      entry.nextTop =
        timeline[index + 1]?.top ??
        Math.max(document.documentElement.scrollHeight, entry.top + 1);
    }
  };

  const resolve = (): { day: number; index: number } => {
    const readingY = window.scrollY + chromeOffset();
    let index = 0;

    for (let cursor = 0; cursor < timeline.length; cursor += 1) {
      if (readingY >= timeline[cursor].top) index = cursor;
      else break;
    }

    const entry = timeline[index];
    if (!entry) return { day: MAX_DAYS, index: 0 };

    const span = Math.max(entry.nextTop - entry.top, 1);
    const within = Math.min(
      1,
      Math.max(0, (readingY - entry.top) / span),
    );
    const range = entry.meta.dayStart - entry.meta.dayEnd;
    const day = entry.meta.dayStart - within * range;

    return { day, index };
  };

  const update = (): void => {
    if (timeline.length === 0) return;

    const { day, index } = resolve();
    const rounded = Math.max(0, Math.min(MAX_DAYS, Math.round(day)));
    const section = timeline[index].meta;

    choreo.day = day;
    choreo.uDay = dayToProgress(day);

    if (rounded !== currentDay) {
      currentDay = rounded;
      value.textContent = String(rounded);
      unit.textContent = rounded === 1 ? "day to impact" : "days to impact";
      rail.style.setProperty(
        "--rail-progress",
        String((MAX_DAYS - rounded) / MAX_DAYS),
      );
    }

    if (section.id !== currentSectionId) {
      currentSectionId = section.id;
      links.forEach((link) => {
        link.classList.toggle(
          "is-chapter-current",
          link.dataset.section === currentSectionId,
        );
      });

      for (const element of document.querySelectorAll<HTMLElement>(
        ".nav__link",
      )) {
        element.classList.toggle(
          "is-active",
          element.dataset.section === currentSectionId,
        );
      }
    }

    links.forEach((link) => {
      link.classList.toggle(
        "is-current",
        Number(link.dataset.day) === currentDay,
      );
      link.removeAttribute("aria-current");
    });

    const exact = links.find(
      (link) => Number(link.dataset.day) === currentDay,
    );

    const anchor = MOBILE_QUERY.matches
      ? links.find(
          (link) =>
            link.dataset.section === currentSectionId &&
            link.classList.contains("is-chapter"),
        )
      : exact;

    anchor?.setAttribute("aria-current", "step");
  };

  const scheduleUpdate = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };

  const scrollToDay = (link: HTMLElement): void => {
    const day = Number(link.dataset.day);
    if (!Number.isFinite(day)) return;

    const section = chapterForDay(day);
    const entry = timeline.find((item) => item.meta.id === section.id);
    if (!entry) return;

    const range = entry.meta.dayStart - entry.meta.dayEnd;
    let progressInSection: number;

    if (range === 0) {
      progressInSection = 0;
    } else {
      progressInSection = (entry.meta.dayStart - day) / range;
      if (progressInSection >= 1) progressInSection = 0.998;
    }

    const readingY =
      entry.top + progressInSection * (entry.nextTop - entry.top);
    const target = Math.max(0, readingY - chromeOffset());

    scroll.scrollTo(target, reducedMotion.matches);
    status.textContent = `${formatDay(day)} — ${section.label}`;
  };

  for (const link of links) {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      scrollToDay(link);
    });
  }

  nav.addEventListener("keydown", (event) => {
    const visible = links.filter(
      (link) => getComputedStyle(link).display !== "none",
    );
    const index = visible.indexOf(document.activeElement as HTMLElement);

    if (index < 0) return;

    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;

    if (step === 0 && event.key !== "Home" && event.key !== "End") return;

    event.preventDefault();

    if (event.key === "Home") {
      visible[0]?.focus();
    } else if (event.key === "End") {
      visible[visible.length - 1]?.focus();
    } else {
      visible[(index + step + visible.length) % visible.length]?.focus();
    }
  });

  nav.addEventListener("focusin", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>(
      ".day-rail__day",
    );
    if (!link || rail.scrollWidth <= rail.clientWidth) return;
    link.scrollIntoView({ block: "nearest", inline: "center" });
  });

  const refresh = (): void => {
    measure();
    update();
  };

  const onResize = (): void => scheduleUpdate();
  const onScroll = (): void => scheduleUpdate();

  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  ScrollTrigger.addEventListener("refresh", refresh);
  document.fonts.ready.then(refresh);

  requestAnimationFrame(() => {
    measure();
    update();
  });

  return {
    refresh,
    destroy: () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      ScrollTrigger.removeEventListener("refresh", refresh);
    },
  };
}
