import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/mohamed-tamheed/",
  plugins: [react()],
  build: {
    outDir: "../work/github-pages-dist",
    emptyOutDir: true,
  },
});
