import { gsap, ScrollTrigger } from "../lib/motion";

const pad = (value: number) => String(value).padStart(2, "0");

export function initGallery(): void {
  const section = document.getElementById("gallery");
  const viewport = document.getElementById("gallery-viewport");
  const track = document.getElementById("gallery-track");
  const progress = document.getElementById("gallery-progress");
  const count = document.getElementById("gallery-count");
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tilt]"),
  );

  if (!section || !viewport || !track || cards.length === 0) return;

  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);

    const horizontal = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (progress) {
            progress.style.transform = `scaleX(${self.progress})`;
          }

          if (count) {
            const plate = Math.min(
              cards.length,
              Math.floor(self.progress * cards.length) + 1,
            );
            count.textContent = `${pad(plate)} / ${pad(cards.length)}`;
          }
        },
      },
    });

    const cleanups: (() => void)[] = [];

    for (const card of cards) {
      const rotateX = gsap.quickTo(card, "rotationX", {
        duration: 0.7,
        ease: "power3.out",
      });
      const rotateY = gsap.quickTo(card, "rotationY", {
        duration: 0.7,
        ease: "power3.out",
      });
      const scale = gsap.quickTo(card, "scale", {
        duration: 0.7,
        ease: "power3.out",
      });

      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;

        rotateX((0.5 - py) * 12);
        rotateY((px - 0.5) * 16);
        scale(1.018);
        card.style.setProperty("--glare-x", `${(px * 100).toFixed(1)}%`);
        card.style.setProperty("--glare-y", `${(py * 100).toFixed(1)}%`);
      };

      const onLeave = () => {
        rotateX(0);
        rotateY(0);
        scale(1);
      };

      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);

      cleanups.push(() => {
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
        gsap.set(card, { clearProps: "transform" });
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      horizontal.scrollTrigger?.kill();
      horizontal.kill();
    };
  });

  document.fonts.ready.then(() => ScrollTrigger.refresh());
}
