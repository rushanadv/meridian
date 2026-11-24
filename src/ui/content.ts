import { gsap, ScrollTrigger, reducedMotion } from "../lib/motion";

interface CountState {
  element: HTMLElement;
  target: number;
  comma: boolean;
  proxy: { value: number };
}

function paintCount(state: CountState): void {
  const rounded = Math.round(state.proxy.value);
  state.element.textContent = state.comma
    ? rounded.toLocaleString("en-US")
    : String(rounded);
}

function buildFan(): SVGGeometryElement[] {
  const svg = document.getElementById("viz-fan-svg");
  const fan = document.getElementById("viz-fan");
  if (!svg || !fan) return [];

  const namespace = "http://www.w3.org/2000/svg";
  const members = 41;

  for (let index = 0; index < members; index += 1) {
    const spread = index / (members - 1);
    const endY = 22 + spread * 156;
    const bend = 100 + (endY - 100) * 0.5;

    const path = document.createElementNS(namespace, "path");
    path.setAttribute(
      "d",
      `M24 100 C 96 100 186 ${bend.toFixed(2)} 300 ${endY.toFixed(2)}`,
    );
    path.setAttribute("stroke", "#7fe7ff");
    path.setAttribute("stroke-width", index === 20 ? "1" : "0.55");
    path.setAttribute("opacity", index === 20 ? "0.72" : "0.24");
    path.setAttribute("fill", "none");
    path.setAttribute("class", "viz-member");
    fan.append(path);
  }

  return Array.from(
    fan.querySelectorAll<SVGGeometryElement>("path"),
  );
}

function prepareDraw(targets: SVGGeometryElement[]): void {
  for (const target of targets) {
    const length = target.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) continue;
    target.style.strokeDasharray = `${length}`;
    target.style.strokeDashoffset = `${length}`;
  }
}

function drawAction(targets: SVGGeometryElement[]): void {
  if (reducedMotion.matches) return;

  prepareDraw(targets);

  const timeline = gsap.timeline({
    scrollTrigger: {
      trigger: ".method__steps",
      start: "top 76%",
      once: true,
    },
  });

  timeline.to(targets, {
    strokeDashoffset: 0,
    duration: 1.15,
    ease: "power4.out",
    stagger: 0.035,
  });
}

function initCounts(): CountState[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-count]"))
    .map((element) => {
      const target = Number(element.dataset.count);
      if (!Number.isFinite(target)) return null;

      return {
        element,
        target,
        comma: element.dataset.format === "comma",
        proxy: { value: 0 },
      } satisfies CountState;
    })
    .filter((state): state is CountState => state !== null);
}

function runCounts(states: CountState[], animate: boolean): void {
  const span = 1.5;

  for (const state of states) {
    gsap.killTweensOf(state.proxy);

    if (!animate) {
      state.proxy.value = state.target;
      paintCount(state);
      continue;
    }

    state.proxy.value = 0;
    paintCount(state);

    gsap.to(state.proxy, {
      value: state.target,
      duration: span,
      ease: "power4.out",
      overwrite: true,
      onUpdate: () => paintCount(state),
    });
  }
}

export function initContent(): void {
  const animate = !reducedMotion.matches;

  const fan = buildFan();
  const core = document.getElementById(
    "viz-fan-core",
  ) as SVGGeometryElement | null;
  const reroute = Array.from(
    document.querySelectorAll<SVGGeometryElement>(".viz-new"),
  );
  const drawTargets = [
    ...fan,
    ...(core ? [core] : []),
    ...reroute,
  ];

  drawAction(drawTargets);

  const states = initCounts();
  const replay = document.querySelector<HTMLButtonElement>("[data-replay]");

  if (states.length > 0) {
    startCounts(states, animate, replay);
  }
}

function startCounts(
  states: CountState[],
  animate: boolean,
  replay: HTMLButtonElement | null,
): void {
  if (!animate) {
    runCounts(states, false);
    replay?.addEventListener("click", () => runCounts(states, false));
    return;
  }

  for (const state of states) {
    state.proxy.value = 0;
    paintCount(state);
  }

  ScrollTrigger.create({
    trigger: ".signals__grid",
    start: "top 82%",
    once: true,
    onEnter: () => runCounts(states, true),
  });

  replay?.addEventListener("click", () => {
    runCounts(states, true);

    const mark = replay.querySelector<HTMLElement>(".signals__replay-mark");
    if (mark) {
      gsap.fromTo(
        mark,
        { rotate: 0 },
        { rotate: -360, duration: 0.9, ease: "power3.out", overwrite: true },
      );
    }
  });
}
