export interface SectionMeta {
  id: string;
  index: string;
  label: string;
  navLabel?: string;
  tag: string;
}

/**
 * Single source for section numbering, labels, primary nav and menu order.
 * Adding or reordering a section here updates every label and link.
 */
export const SECTIONS: SectionMeta[] = [
  { id: "hero", index: "01", label: "Hero", navLabel: "Hero", tag: "Orbit" },
  {
    id: "problem",
    index: "02",
    label: "The Problem",
    navLabel: "The Problem",
    tag: "Storm",
  },
  { id: "routes", index: "03", label: "Lane View", tag: "Fleet" },
  {
    id: "method",
    index: "04",
    label: "How It Works",
    navLabel: "Method",
    tag: "Model",
  },
  {
    id: "signals",
    index: "05",
    label: "Signals",
    navLabel: "Numbers",
    tag: "Stats",
  },
];

export function initSections(): void {
  const navLinks = document.querySelector(".nav__links");
  const menuLinks = document.querySelector(".menu__nav");
  const sectionCount = document.querySelector<HTMLElement>(
    "[data-section-count]",
  );

  if (sectionCount) {
    sectionCount.textContent = `${String(SECTIONS.length).padStart(2, "0")} Entries`;
  }

  if (navLinks) {
    navLinks.replaceChildren(
      ...SECTIONS.map(({ id, index, label, navLabel }) => {
        const link = document.createElement("a");
        link.className = "nav__link mono";
        link.href = `#${id}`;
        link.dataset.cursor = "link";

        const text = document.createElement("span");
        text.textContent = navLabel ?? label;

        const number = document.createElement("span");
        number.className = "nav__link-index";
        number.setAttribute("aria-hidden", "true");
        number.textContent = index;

        link.append(text, number);
        return link;
      }),
    );
  }

  if (menuLinks) {
    menuLinks.replaceChildren(
      ...SECTIONS.map(({ id, index, label, tag }) => {
        const link = document.createElement("a");
        link.className = "menu__link";
        link.href = `#${id}`;
        link.dataset.cursor = "link";

        const number = document.createElement("span");
        number.className = "menu__num mono";
        number.textContent = index;

        const text = document.createElement("span");
        text.className = "menu__text";
        text.textContent = label;

        const note = document.createElement("span");
        note.className = "menu__tag mono";
        note.textContent = tag;

        link.append(number, text, note);
        return link;
      }),
    );
  }

  for (const section of SECTIONS) {
    const root = document.getElementById(section.id);
    if (!root) continue;

    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-section-index]",
    )) {
      element.textContent = section.index;
    }

    for (const element of root.querySelectorAll<HTMLElement>(
      "[data-section-label]",
    )) {
      element.textContent = section.label;
    }
  }
}
