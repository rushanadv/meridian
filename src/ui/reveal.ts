import { gsap, reducedMotion } from "../lib/motion";

/**
 * The hero copy arrives on its own DOM clock, independent of WebGL, so the
 * headline is readable even when the planet is slow or unavailable. The nav
 * and day rail are never hidden: the page frame is present from first paint.
 */
export function revealHero(): void {
  if (reducedMotion.matches) {
    gsap.set(
      ".hero__statement, .hero__horizon, .hero__top, .hero__bottom",
      { clearProps: "opacity,visibility,transform" },
    );
    return;
  }

  gsap.set(".line", { yPercent: 118 });
  gsap.set(".hero__eyebrow, .hero__lede", { autoAlpha: 0, y: 18 });
  gsap.set(".hero__top, .hero__bottom", { autoAlpha: 0, y: 12 });
  gsap.set(".hero__horizon", { autoAlpha: 0, yPercent: 9 });
  gsap.set(".hero__horizon-value", { yPercent: 16, scale: 0.96 });

  const timeline = gsap.timeline({ defaults: { ease: "expoOut" } });

  timeline
    .to(
      ".hero__horizon",
      {
        autoAlpha: 1,
        yPercent: 0,
        duration: 1.25,
      },
      0.05,
    )
    .to(
      ".hero__horizon-value",
      {
        yPercent: 0,
        scale: 1,
        duration: 1.4,
      },
      0.05,
    )
    .to(
      ".line",
      {
        yPercent: 0,
        duration: 1.25,
        stagger: 0.09,
      },
      0.3,
    )
    .to(
      ".hero__eyebrow, .hero__lede",
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        stagger: 0.08,
      },
      0.9,
    )
    .set(".line", { clearProps: "transform", immediateRender: false }, 1.7)
    .set(
      ".hero__horizon-value",
      { clearProps: "transform", immediateRender: false },
      1.7,
    );
}

/**
 * The top and bottom instrument lines arrive once the assembly overlay has
 * left, so they never sit under the preloader's own readouts.
 */
export function revealHeroChrome(): void {
  if (reducedMotion.matches) {
    gsap.set(".hero__top, .hero__bottom", {
      clearProps: "opacity,visibility,transform",
    });
    return;
  }

  gsap.to(".hero__top, .hero__bottom", {
    autoAlpha: 1,
    y: 0,
    duration: 0.9,
    ease: "expoOut",
    overwrite: true,
  });
}