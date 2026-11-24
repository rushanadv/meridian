import { gsap, reducedMotion } from "../lib/motion";

export function revealHero(): void {
  if (reducedMotion.matches) {
    gsap.set([".nav", ".day-rail"], { autoAlpha: 1 });
    return;
  }

  gsap.set([".nav", ".day-rail"], { autoAlpha: 0 });
  gsap.set(".line", { yPercent: 118 });
  gsap.set(".hero__eyebrow, .hero__lede", { autoAlpha: 0, y: 18 });
  gsap.set(".hero__top, .hero__bottom", { autoAlpha: 0, y: 12 });
  gsap.set(".hero__horizon", { autoAlpha: 0, yPercent: 9 });
  gsap.set(".hero__horizon-value", { yPercent: 16, scale: 0.96 });

  const timeline = gsap.timeline({ defaults: { ease: "expoOut" } });

  timeline
    .to([".nav", ".day-rail"], { autoAlpha: 1, duration: 1 }, 0)
    .to(
      ".hero__horizon",
      {
        autoAlpha: 1,
        yPercent: 0,
        duration: 1.25,
      },
      0.1,
    )
    .to(
      ".hero__horizon-value",
      {
        yPercent: 0,
        scale: 1,
        duration: 1.4,
      },
      0.1,
    )
    .to(
      ".line",
      {
        yPercent: 0,
        duration: 1.25,
        stagger: 0.09,
      },
      0.35,
    )
    .to(
      ".hero__eyebrow, .hero__lede",
      {
        autoAlpha: 1,
        y: 0,
        duration: 1.1,
        stagger: 0.08,
      },
      0.95,
    )
    .to(
      ".hero__top, .hero__bottom",
      {
        autoAlpha: 1,
        y: 0,
        duration: 1,
      },
      1.1,
    )
    .set(".line", { clearProps: "transform", immediateRender: false }, 1.75)
    .set(
      ".hero__horizon-value",
      { clearProps: "transform", immediateRender: false },
      1.75,
    );
}
