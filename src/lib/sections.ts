export interface SectionMeta {
  id: string;
  label: string;
  navLabel?: string;
  tag: string;
  dayStart: number;
  dayEnd: number;
  primaryNav: boolean;
}

/**
 * Single source for chapter order, days-to-impact ranges, nav labels and
 * menu order. Order is descending in forecast time: T-14 to T-0.
 */
export const SECTIONS: SectionMeta[] = [
  {
    id: "hero",
    label: "The futures open",
    navLabel: "Overview",
    tag: "Futures",
    dayStart: 14,
    dayEnd: 12,
    primaryNav: true,
  },
  {
    id: "problem",
    label: "Uncertainty becomes cost",
    navLabel: "Problem",
    tag: "Storm",
    dayStart: 11,
    dayEnd: 10,
    primaryNav: true,
  },
  {
    id: "method",
    label: "Resolve the ensemble",
    navLabel: "Method",
    tag: "Model",
    dayStart: 9,
    dayEnd: 8,
    primaryNav: true,
  },
  {
    id: "signals",
    label: "Calibration check",
    navLabel: "Signals",
    tag: "Calibration",
    dayStart: 7,
    dayEnd: 6,
    primaryNav: true,
  },
  {
    id: "routes",
    label: "One lane bends",
    navLabel: "Lanes",
    tag: "Reroute",
    dayStart: 5,
    dayEnd: 4,
    primaryNav: true,
  },
  {
    id: "gallery",
    label: "Evidence plates",
    navLabel: "Field",
    tag: "Plates",
    dayStart: 3,
    dayEnd: 3,
    primaryNav: true,
  },
  {
    id: "voices",
    label: "Desk transmissions",
    navLabel: "Desk",
    tag: "Voices",
    dayStart: 2,
    dayEnd: 2,
    primaryNav: true,
  },
  {
    id: "pricing",
    label: "Choose the lead",
    navLabel: "Plans",
    tag: "Lead",
    dayStart: 1,
    dayEnd: 1,
    primaryNav: true,
  },
  {
    id: "footer",
    label: "Forecast issued",
    navLabel: "Issued",
    tag: "Issued",
    dayStart: 0,
    dayEnd: 0,
    primaryNav: false,
  },
];

export const CHAPTERS = SECTIONS.filter((section) => section.id !== "footer");

export function initSections(): void {
  const navLinks = document.querySelector(".nav__links");
  const menuLinks = document.querySelector(".menu__nav");
  const sectionCount = document.querySelector<HTMLElement>(
    "[data-section-count]",
  );
  const main = document.querySelector("main");

  const roots = CHAPTERS.map(({ id }) => document.getElementById(id)).filter(
    (root): root is HTMLElement => root !== null,
  );

  if (main && roots.length > 0) {
    for (const root of roots) {
      main.append(root);
    }
  }

  if (sectionCount) {
    sectionCount.textContent = `${String(SECTIONS.length).padStart(2, "0")} Chapters`;
  }

  if (navLinks) {
    navLinks.replaceChildren(
      ...CHAPTERS.filter(({ primaryNav }) => primaryNav).map(
        ({ id, navLabel, label, dayStart }) => {
          const link = document.createElement("a");
          link.className = "nav__link mono";
          link.href = `#${id}`;
          link.dataset.cursor = "link";
          link.dataset.section = id;

          const text = document.createElement("span");
          text.textContent = navLabel ?? label;

          const day = document.createElement("span");
          day.className = "nav__link-day";
          day.setAttribute("aria-hidden", "true");
          day.textContent = `T−${dayStart}`;

          link.append(text, day);
          return link;
        },
      ),
    );
  }

  if (menuLinks) {
    menuLinks.replaceChildren(
      ...SECTIONS.map(({ id, label, tag, dayStart }) => {
        const link = document.createElement("a");
        link.className = "menu__link";
        link.href = `#${id}`;
        link.dataset.cursor = "link";

        const day = document.createElement("span");
        day.className = "menu__num mono";
        day.textContent = `T−${dayStart}`;

        const text = document.createElement("span");
        text.className = "menu__text";
        text.textContent = label;

        const note = document.createElement("span");
        note.className = "menu__tag mono";
        note.textContent = tag;

        link.append(day, text, note);
        return link;
      }),
    );
  }

  for (const section of SECTIONS) {
    const root = document.getElementById(section.id);
    if (!root) continue;

    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-section-day]",
    )) {
      element.textContent = dayLabel(section);
    }

    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-section-label]",
    )) {
      element.textContent = section.label;
    }
  }
}

export function dayLabel(section: SectionMeta): string {
  if (section.dayStart === 0) return "Impact";

  const span =
    section.dayStart === section.dayEnd
      ? `${section.dayStart}`
      : `${section.dayStart}–${section.dayEnd}`;

  return `${span} ${section.dayStart === 1 ? "day" : "days"} to impact`;
}
