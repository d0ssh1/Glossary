/// <reference types="vitest/config" />
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { inspectAttr } from "kimi-plugin-inspect-react";

// https://vite.dev/config/
// Vitest test settings live alongside Vite config — one source of truth.
export default defineConfig({
  base: "./",
  plugins: [inspectAttr(), react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["node_modules", "dist", "e2e", ".idea", ".git", ".cache"],
  },
});
