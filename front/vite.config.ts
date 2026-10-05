/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: true,
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
    // Traefik forwards requests with the *.localhost host header.
    allowedHosts: [".localhost"],
  },
  test: {
    globals: true,
    // React only ships act() in its development build; a global NODE_ENV=production would hide it.
    env: { NODE_ENV: "test" },
    environment: "./src/test/environment.ts",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
