import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [wasm(), topLevelAwait(), svelte()],
  base: "/",
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1024,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return id
              .toString()
              .split("node_modules/")[1]
              .split("/")[0]
              .toString();
          }
        },
      },
    },
  },
});
