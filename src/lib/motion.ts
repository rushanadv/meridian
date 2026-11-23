import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, CustomEase);

CustomEase.create("expoOut", "0.16, 1, 0.3, 1");
CustomEase.create("power4InOut", "0.76, 0, 0.24, 1");

gsap.defaults({ ease: "expoOut" });

export const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
export const finePointer = window.matchMedia("(pointer: fine)");
export const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

export { gsap, ScrollTrigger };
