// Build of the webview client into dist/client (index.html + main.ts bundle).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
  },
});
