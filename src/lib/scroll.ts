import Lenis from "lenis";
import { gsap, ScrollTrigger, reducedMotion } from "./motion";
import { choreo } from "./choreography";

export interface ScrollController {
  refresh: () => void;
  destroy: () => void;
  stop: () => void;
  start: () => void;
  scrollTo: (target: string | number, immediate?: boolean) => void;
}

export function initScroll(): ScrollController {
  let lenis: Lenis | null = null;

  const raf = (time: number) => {
    lenis?.raf(time * 1000);
  };

  const stopLenis = () => {
    if (!lenis) return;
    gsap.ticker.remove(raf);
    lenis.destroy();
    lenis = null;
  };

  const startLenis = () => {
    if (lenis || reducedMotion.matches) return;

    lenis = new Lenis({
      autoRaf: false,
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.2,
      anchors: true,
    });

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  };

  ScrollTrigger.config({ ignoreMobileResize: true });

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const heroExit = gsap.timeline({
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        end: "bottom top",
        scrub: 0.7,
      },
    });

    heroExit
      .to(".hero__statement", { yPercent: -14, autoAlpha: 0, ease: "none" }, 0)
      .to(".hero__horizon", { yPercent: -10, ease: "none" }, 0)
      .to(".hero__top, .hero__bottom", { autoAlpha: 0, ease: "none" }, 0.15);

    const smooth = (value: number) => {
      const t = Math.min(1, Math.max(0, value));
      return t * t * (3 - 2 * t);
    };

    // The pin is the dive: hero orbit at entry, cyclone close-up once the
    // last sentence lands, then hold while the reader finishes the chapter.
    ScrollTrigger.create({
      trigger: "#problem",
      start: "top top",
      end: () => `+=${Math.round(window.innerHeight * 1.8)}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        choreo.state = smooth((self.progress - 0.04) / 0.58);
      },
    });

    // The camera pulls back out of the cyclone as the lane view arrives.
    ScrollTrigger.create({
      trigger: "#routes",
      start: "top bottom",
      end: "top top",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        choreo.state = 1 + smooth(self.progress);
      },
    });

    gsap.fromTo(
      choreo,
      { veil: 0 },
      {
        veil: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#pricing",
          start: "top 82%",
          end: "top 24%",
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      },
    );

    const pricingTl = gsap.timeline({
      scrollTrigger: {
        trigger: "#pricing",
        start: "top 90%",
        end: "bottom 10%",
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });

    pricingTl
      .to(choreo, { pricing: 1, duration: 0.45, ease: "none" })
      .to(choreo, { pricing: 1, duration: 0.15 })
      .to(choreo, { pricing: 0, duration: 0.4, ease: "none" });

    gsap.from(".routes__row", {
      opacity: 0,
      y: 26,
      stagger: 0.09,
      duration: 1.1,
      ease: "expoOut",
      scrollTrigger: {
        trigger: ".routes__legend",
        start: "top 96%",
      },
    });

    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      gsap.set(".problem__sentence", { clearProps: "opacity,transform" });
      choreo.state = 0;
      choreo.veil = 0;
      choreo.pricing = 0;
      choreo.day = 14;
      choreo.uDay = 0;
      choreo.lanes = 0;
      choreo.reroute = 0;
    };
  });

  const syncMotionPreference = () => {
    if (reducedMotion.matches) {
      stopLenis();
      ScrollTrigger.refresh();
    } else {
      startLenis();
    }
  };

  let refreshFrame = 0;
  const refreshLayout = () => {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      ScrollTrigger.refresh();
    });
  };

  window.addEventListener("resize", refreshLayout, { passive: true });
  window.addEventListener("orientationchange", refreshLayout, { passive: true });
  reducedMotion.addEventListener("change", syncMotionPreference);
  startLenis();

  document.fonts.ready.then(() => ScrollTrigger.refresh());

  return {
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      window.removeEventListener("resize", refreshLayout);
      window.removeEventListener("orientationchange", refreshLayout);
      reducedMotion.removeEventListener("change", syncMotionPreference);
      stopLenis();
      mm.revert();
    },
    stop: () => {
      lenis?.stop();
    },
    start: () => {
      lenis?.start();
    },
    scrollTo: (target, immediate = false) => {
      const element =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : null;
      // Lenis subtracts the root scroll-padding from anchor targets; adding it
      // back lands the chapter itself at the top of the viewport, with the
      // chapter's own chrome padding clearing the nav.
      const scrollPadding =
        Number.parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        ) || 0;
      const offset = typeof target === "string" ? scrollPadding : 0;

      if (lenis) {
        lenis.scrollTo(
          element ?? target,
          immediate
            ? { offset, immediate: true }
            : { offset, duration: 1.25 },
        );

        if (immediate) ScrollTrigger.update();
        return;
      }

      const top =
        element !== null
          ? element.getBoundingClientRect().top + window.scrollY + offset
          : typeof target === "number"
            ? target
            : 0;

      window.scrollTo({
        top,
        behavior: immediate || reducedMotion.matches ? "auto" : "smooth",
      });

      if (immediate) ScrollTrigger.update();
    },
  };
}
