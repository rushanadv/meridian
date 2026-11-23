import Lenis from "lenis";
import { gsap, ScrollTrigger, reducedMotion } from "./motion";

export const scrollState = {
  progress: 0,
};

export function initScroll(): { refresh: () => void; destroy: () => void } {
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
    ScrollTrigger.create({
      trigger: "#manifesto",
      start: "top bottom",
      end: "top 25%",
      onUpdate: (self) => {
        scrollState.progress = self.progress;
      },
    });

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
      .to(".wordmark", { yPercent: -10, ease: "none" }, 0)
      .to(".hero__top, .hero__bottom", { autoAlpha: 0, ease: "none" }, 0.15);

    return () => {
      scrollState.progress = 0;
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

  reducedMotion.addEventListener("change", syncMotionPreference);
  startLenis();

  document.fonts.ready.then(() => ScrollTrigger.refresh());

  return {
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      reducedMotion.removeEventListener("change", syncMotionPreference);
      stopLenis();
      mm.revert();
    },
  };
}
