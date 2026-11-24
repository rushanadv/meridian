import { gsap, reducedMotion } from "../lib/motion";
import type { ScrollController } from "../lib/scroll";

export function initNav(scroll: ScrollController): void {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 16);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!toggle || !menu) return;

  const label = toggle.querySelector<HTMLElement>(".nav__menu-label");

  const setToggleLabel = (isOpen: boolean) => {
    if (label) label.textContent = isOpen ? "Close" : "Index";
    toggle.setAttribute("aria-label", isOpen ? "Close index" : "Open index");
  };

  const links = Array.from(
    menu.querySelectorAll<HTMLAnchorElement>(".menu__link"),
  );

  let open = false;
  let pendingHref: string | null = null;

  const timeline = reducedMotion.matches
    ? null
    : gsap
        .timeline({
          paused: true,
          defaults: { ease: "expoOut" },
          onReverseComplete: () => {
            menu.setAttribute("aria-hidden", "true");
            menu.inert = true;
            menu.classList.remove("is-open");
            document.body.classList.remove("is-menu");
            scroll.start();
            toggle.focus({ preventScroll: true });
            setToggleLabel(false);

            if (pendingHref) {
              const href = pendingHref;
              pendingHref = null;
              scroll.scrollTo(href);
            }
          },
        })
        .set(menu, { visibility: "visible", pointerEvents: "auto" })
        .to(menu, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.05 }, 0)
        .fromTo(
          ".menu__head",
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.7 },
          0.15,
        )
        .fromTo(
          links,
          { yPercent: 120, autoAlpha: 0 },
          {
            yPercent: 0,
            autoAlpha: 1,
            duration: 0.8,
            stagger: 0.06,
          },
          0.2,
        )
        .fromTo(
          ".menu__aside",
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.6 },
          0.45,
        );

  const openMenu = () => {
    if (open) return;
    open = true;
    pendingHref = null;

    toggle.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
    menu.inert = false;
    menu.classList.add("is-open");
    document.body.classList.add("is-menu");
    scroll.stop();
    setToggleLabel(true);

    if (timeline) {
      timeline.timeScale(1).play();
    } else {
      menu.style.visibility = "visible";
      menu.style.clipPath = "inset(0% 0% 0% 0%)";
    }

    window.setTimeout(
      () => links[0]?.focus({ preventScroll: true }),
      timeline ? 620 : 0,
    );
  };

  const closeMenu = () => {
    if (!open) return;
    open = false;

    toggle.setAttribute("aria-expanded", "false");

    if (timeline) {
      timeline.reverse();
    } else {
      menu.setAttribute("aria-hidden", "true");
      menu.inert = true;
      menu.classList.remove("is-open");
      menu.style.visibility = "hidden";
      menu.style.clipPath = "inset(0 0 100% 0)";
      document.body.classList.remove("is-menu");
      scroll.start();
      toggle.focus({ preventScroll: true });
      setToggleLabel(false);

      if (pendingHref) {
        const href = pendingHref;
        pendingHref = null;
        scroll.scrollTo(href);
      }
    }
  };

  toggle.addEventListener("click", () => {
    if (open) closeMenu();
    else openMenu();
  });

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const href = link.getAttribute("href");
      if (!href) return;

      pendingHref = href;
      closeMenu();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === "Tab" && links.length > 0) {
      const first = links[0];
      const last = links[links.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        toggle.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        toggle.focus();
      }
    }
  });
}
