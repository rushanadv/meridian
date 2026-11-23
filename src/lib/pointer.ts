export const pointer = {
  /** Damped values used by the scene. */
  x: 0,
  y: 0,
  /** Raw normalized target, -1..1. */
  tx: 0,
  ty: 0,
  /** Normalized viewport position, 0..1. */
  px: 0.5,
  py: 0.5,
};

export function initPointer(): () => void {
  const onMove = (event: PointerEvent) => {
    pointer.px = event.clientX / window.innerWidth;
    pointer.py = event.clientY / window.innerHeight;
    pointer.tx = pointer.px * 2 - 1;
    pointer.ty = -(pointer.py * 2 - 1);
  };

  window.addEventListener("pointermove", onMove, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onMove);
  };
}
