/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Tauri expects a fixed port and no auto-open
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            "@codemirror/view",
            "@codemirror/state",
            "@codemirror/language",
            "@codemirror/commands",
            "@codemirror/search",
            "@codemirror/lang-markdown",
            "@codemirror/autocomplete",
          ],
          milkdown: [
            "@milkdown/core",
            "@milkdown/ctx",
            "@milkdown/prose",
            "@milkdown/preset-commonmark",
            "@milkdown/preset-gfm",
            "@milkdown/react",
          ],
          vendor: ["react", "react-dom", "zustand", "nanoid", "clsx"],
          mermaid: ["mermaid"],
          katex: ["katex"],
          shiki: ["shiki"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
