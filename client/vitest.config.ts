import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
    },
  },
  test: {
    globals: true,
    name: "unit",
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "hooks/**/*.test.ts",
      "hooks/**/*.test.tsx",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
    ],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
