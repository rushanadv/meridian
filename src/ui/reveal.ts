import { gsap, reducedMotion } from "../lib/motion";

export function revealHero(): void {
  if (reducedMotion.matches) {
    gsap.set(".nav", { autoAlpha: 1 });
    return;
  }

  gsap.set(".nav", { autoAlpha: 0 });
  gsap.set(".wm-letter", { yPercent: 135, rotate: 7, opacity: 0 });
  gsap.set(".line", { yPercent: 118 });
  gsap.set(".hero__eyebrow, .hero__lede", { autoAlpha: 0, y: 18 });
  gsap.set(".hero__top, .hero__bottom", { autoAlpha: 0, y: 12 });

  const timeline = gsap.timeline({ defaults: { ease: "expoOut" } });

  timeline
    .to(".nav", { autoAlpha: 1, duration: 1 }, 0)
    .to(
      ".wm-letter",
      {
        yPercent: 0,
        rotate: 0,
        opacity: 1,
        duration: 1.5,
        stagger: 0.055,
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
    .set(".wm-letter", { clearProps: "transform,opacity", immediateRender: false }, 1.75)
    .set(".line", { clearProps: "transform", immediateRender: false }, 1.75);
}
