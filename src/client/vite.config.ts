// Сборка webview-клиента в dist/client (index.html + бандл main.ts).
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: true,
  },
});
