import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["worker/**/*.test.mjs"],
    testTimeout: 15000,
    globals: true,
  },
});
