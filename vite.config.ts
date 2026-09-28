import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [wasm(), svelte()],
  base: "/",
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1024,
    rolldownOptions: {
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
