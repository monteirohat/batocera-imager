// Vite builds the renderer (the React interface). The main and preload processes
// are compiled separately with tsc (see tsconfig.main.json).
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
