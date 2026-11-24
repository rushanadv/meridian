import { gsap, finePointer, reducedMotion } from "../lib/motion";

interface CursorOptions {
  isOverGlobe: (clientX: number, clientY: number) => boolean;
}

export function initCursor({ isOverGlobe }: CursorOptions): void {
  if (!finePointer.matches || reducedMotion.matches) return;

  const root = document.getElementById("cursor");
  const dot = document.getElementById("cursor-dot");
  const ring = document.getElementById("cursor-ring");
  const label = document.getElementById("cursor-label");

  if (!root || !dot || !ring || !label) return;

  document.documentElement.classList.add("has-cursor");

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;

  gsap.set([dot, ring], {
    xPercent: -50,
    yPercent: -50,
    x: mx,
    y: my,
  });

  const moveDotX = gsap.quickTo(dot, "x", { duration: 0.07, ease: "expoOut" });
  const moveDotY = gsap.quickTo(dot, "y", { duration: 0.07, ease: "expoOut" });
  const moveRingX = gsap.quickTo(ring, "x", { duration: 0.12, ease: "expoOut" });
  const moveRingY = gsap.quickTo(ring, "y", { duration: 0.12, ease: "expoOut" });

  const setMode = (mode: "link" | "explore" | "drag" | null) => {
    root.classList.toggle("is-link", mode === "link");
    root.classList.toggle("is-explore", mode === "explore");
    root.classList.toggle("is-drag", mode === "drag");
    label.textContent =
      mode === "explore" ? "EXPLORE" : mode === "drag" ? "DRAG" : "";
  };

  let frame = 0;

  const evaluate = () => {
    frame = 0;
    const element = document.elementFromPoint(mx, my);
    const interactive = element?.closest("a, button, [data-cursor='link']");
    const dragZone = element?.closest("[data-cursor='drag']");

    if (interactive) {
      setMode("link");

      const labeledControl =
        interactive.id === "menu-toggle" ||
        interactive.hasAttribute("data-magnetic");

      label.textContent = labeledControl
        ? ""
        : interactive.getAttribute("aria-expanded") === "true"
          ? "CLOSE"
          : "OPEN";
    } else if (dragZone) {
      setMode("drag");
    } else if (isOverGlobe(mx, my)) {
      setMode("explore");
    } else {
      setMode(null);
    }
  };

  const onMove = (event: PointerEvent) => {
    mx = event.clientX;
    my = event.clientY;
    moveDotX(mx);
    moveDotY(my);
    moveRingX(mx);
    moveRingY(my);

    if (!frame) frame = window.requestAnimationFrame(evaluate);
  };

  window.addEventListener("pointermove", onMove, { passive: true });

  document.addEventListener("pointerleave", () => {
    gsap.to(root, { autoAlpha: 0, duration: 0.28, overwrite: true });
  });

  document.addEventListener("pointerenter", () => {
    gsap.to(root, { autoAlpha: 1, duration: 0.28, overwrite: true });
  });
}
