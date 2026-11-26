import type { ScrollController } from "./scroll";

export interface ChapterConfig {
  id: string;
  label: string;
  navLabel: string;
  tag: string;
  dayStart: number;
  dayEnd: number;
  ariaLabel: string;
  primaryNav: boolean;
}

/**
 * The one source of truth for chapter order and the day rail mapping.
 * Day ranges are inclusive: the rail resolves a day to the first chapter
 * whose range contains it.
 */
export const CHAPTERS: ChapterConfig[] = [
  {
    id: "hero",
    label: "Hero",
    navLabel: "Overview",
    tag: "Futures",
    dayStart: 14,
    dayEnd: 12,
    ariaLabel: "Forecast overview, days fourteen through twelve to impact",
    primaryNav: true,
  },
  {
    id: "problem",
    label: "Storm",
    navLabel: "Storm",
    tag: "Signals",
    dayStart: 11,
    dayEnd: 8,
    ariaLabel: "Storm outlook and live readouts bound to the day, days eleven through eight",
    primaryNav: true,
  },
  {
    id: "routes",
    label: "Lanes",
    navLabel: "Lanes",
    tag: "Decisions",
    dayStart: 7,
    dayEnd: 3,
    ariaLabel: "Ingest, resolve and reroute shipping lanes, days seven through three",
    primaryNav: true,
  },
  {
    id: "pricing",
    label: "Horizon",
    navLabel: "Horizon",
    tag: "Desk",
    dayStart: 2,
    dayEnd: 1,
    ariaLabel: "Forecast desk testimony and plan horizons, days two through one",
    primaryNav: true,
  },
  {
    id: "issued",
    label: "Issued",
    navLabel: "Issued",
    tag: "Impact",
    dayStart: 0,
    dayEnd: 0,
    ariaLabel: "Forecast issued at impact, day zero",
    primaryNav: true,
  },
];

const LEGACY_ANCHORS: Record<string, string> = {
  method: "routes",
  signals: "problem",
  gallery: "routes",
  voices: "pricing",
  footer: "issued",
};

export interface HashResolution {
  target: string;
  legacy: boolean;
}

export function resolveChapterHash(hash: string): HashResolution | null {
  const id = hash.replace(/^#/, "");
  if (!id) return null;

  const mapped = LEGACY_ANCHORS[id];
  const target = mapped ?? id;

  if (!CHAPTERS.some((chapter) => chapter.id === target)) return null;
  return { target: `#${target}`, legacy: Boolean(mapped) };
}

export function initSections(): void {
  const navLinks = document.querySelector(".nav__links");
  const menuLinks = document.querySelector(".menu__nav");
  const footerNav = document.querySelector(".footer__nav");
  const sectionCount =
    document.querySelector<HTMLElement>("[data-section-count]");
  const main = document.querySelector("main");

  if (!main) return;

  const roots = CHAPTERS.map(({ id }) => document.getElementById(id)).filter(
    (root): root is HTMLElement => root !== null,
  );

  for (const root of roots) {
    if (root.parentElement === main) main.append(root);
  }

  if (sectionCount) {
    sectionCount.textContent = `${String(CHAPTERS.length).padStart(2, "0")} Chapters`;
  }

  if (navLinks) {
    navLinks.replaceChildren(
      ...CHAPTERS.filter((chapter) => chapter.primaryNav).map((chapter) =>
        makeLink(chapter, "nav"),
      ),
    );
  }

  if (menuLinks) {
    menuLinks.replaceChildren(
      ...CHAPTERS.filter((chapter) => chapter.primaryNav).map((chapter) =>
        makeLink(chapter, "menu"),
      ),
    );
  }

  if (footerNav) {
    const footerLinks = CHAPTERS.filter((chapter) => chapter.primaryNav).map(
      (chapter) => {
        const link = document.createElement("a");
        link.href = `#${chapter.id}`;
        link.dataset.cursor = "link";
        link.textContent = chapter.id === "hero" ? "Top" : chapter.navLabel;
        link.setAttribute(
          "aria-label",
          `${chapter.label}, ${chapter.ariaLabel}`,
        );
        return link;
      },
    );

    const desk = document.createElement("a");
    desk.href = "mailto:desk@meridian.systems";
    desk.dataset.cursor = "link";
    desk.textContent = "Forecast desk";

    footerNav.replaceChildren(...footerLinks, desk);
  }

  for (const chapter of CHAPTERS) {
    const root = document.getElementById(chapter.id);
    if (!root) continue;
    root.setAttribute("aria-label", chapter.ariaLabel);
    root.dataset.dayStart = String(chapter.dayStart);
    root.dataset.dayEnd = String(chapter.dayEnd);
  }
}

/** Resolve an old hash to its nearest surviving chapter and scroll there. */
export function applyHashRoute(scroll: ScrollController): void {
  const resolved = resolveChapterHash(location.hash);
  if (!resolved) return;

  if (resolved.legacy) {
    history.replaceState(null, "", resolved.target);
  }

  requestAnimationFrame(() => {
    if (document.querySelector(resolved.target)) {
      scroll.scrollTo(resolved.target, true);
    }
  });
}

function makeLink(
  chapter: ChapterConfig,
  variant: "nav" | "menu",
): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = `#${chapter.id}`;
  link.dataset.cursor = "link";
  link.dataset.section = chapter.id;

  if (variant === "nav") {
    link.className = "nav__link mono";
    const text = document.createElement("span");
    text.textContent = chapter.navLabel;
    const day = document.createElement("span");
    day.className = "nav__link-day";
    day.setAttribute("aria-hidden", "true");
    day.textContent = `D${String(chapter.dayStart).padStart(2, "0")}`;
    link.setAttribute(
      "aria-label",
      `${chapter.navLabel}, ${chapter.ariaLabel}`,
    );
    link.append(text, day);
    return link;
  }

  link.className = "menu__link";
  link.setAttribute(
    "aria-label",
    `${chapter.label}, ${dayLabel(chapter)}, ${chapter.ariaLabel}`,
  );

  const index = CHAPTERS.indexOf(chapter) + 1;
  const num = document.createElement("span");
  num.className = "menu__num mono";
  num.setAttribute("aria-hidden", "true");
  num.textContent = String(index).padStart(2, "0");

  const text = document.createElement("span");
  text.className = "menu__text";
  text.textContent = chapter.label;

  const tag = document.createElement("span");
  tag.className = "menu__tag mono";
  tag.setAttribute("aria-hidden", "true");
  tag.textContent = dayLabel(chapter);

  link.append(num, text, tag);
  return link;
}

export function chapterForDay(day: number): ChapterConfig {
  return (
    CHAPTERS.find(
      (chapter) => day >= chapter.dayEnd && day <= chapter.dayStart,
    ) ?? CHAPTERS[CHAPTERS.length - 1]
  );
}

export function dayLabel(chapter: ChapterConfig): string {
  const start = `D${String(chapter.dayStart).padStart(2, "0")}`;
  if (chapter.dayStart === chapter.dayEnd) return start;
  return `${start}–D${String(chapter.dayEnd).padStart(2, "0")}`;
}