import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true, port: 5173 },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 560,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("three/examples") || id.includes("three/addons")) {
            return "three-addons";
          }
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/gsap")) return "gsap";
          if (id.includes("node_modules/lenis")) return "lenis";
          return undefined;
        },
      },
    },
  },
});
