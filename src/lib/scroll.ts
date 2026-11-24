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

    const words = gsap.utils.toArray<HTMLElement>(".problem__word");

    gsap.set(words, { opacity: 0.2, color: "#f2eee6" });

    const wordsTl = gsap.timeline({
      scrollTrigger: {
        trigger: "#problem",
        start: "top top",
        end: "+=100%",
        pin: true,
        scrub: 0.7,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    words.forEach((word, index) => {
      wordsTl.to(
        word,
        { opacity: 1, duration: 0.5, ease: "none" },
        index * 0.16,
      );

      if (word.classList.contains("problem__word--key")) {
        wordsTl.set(word, { color: "#7fe7ff" }, index * 0.16 + 0.5);
      }
    });

    const master = gsap.timeline({
      scrollTrigger: {
        trigger: "#hero",
        start: "top top",
        endTrigger: "#routes",
        end: "bottom bottom",
        scrub: 0.9,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    master
      .to(choreo, { state: 1, duration: 0.27, ease: "none" }, 0.16)
      .to(choreo, { state: 2, duration: 0.38, ease: "none" }, 0.62);

    gsap.fromTo(
      choreo,
      { veil: 0 },
      {
        veil: 1,
        ease: "none",
        scrollTrigger: {
          trigger: "#method",
          start: "top 32%",
          end: "top top",
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

    gsap.fromTo(
      ".routes__copy",
      { yPercent: 9 },
      {
        yPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: "#routes",
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8,
        },
      },
    );

    gsap.from(".routes__row", {
      opacity: 0,
      y: 26,
      stagger: 0.09,
      duration: 1.1,
      ease: "expoOut",
      scrollTrigger: {
        trigger: ".routes__legend",
        start: "top 78%",
      },
    });

    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      gsap.set(".problem__word", { clearProps: "opacity,color" });
      choreo.state = 0;
      choreo.veil = 0;
      choreo.pricing = 0;
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
      const offset = typeof target === "string"
        ? target === "#problem"
          ? 0
          : -90
        : 0;

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
