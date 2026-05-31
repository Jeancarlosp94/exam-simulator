import { defineConfig } from "vitest/config";

/**
 * Vitest config. Vitest 4 / Vite 7 resolves tsconfig paths natively via
 * `resolve.tsconfigPaths: true` — no plugin needed. Tests run in node
 * env by default (cheap); flip to jsdom per-file via the
 * `// @vitest-environment jsdom` directive when testing React components.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "tests/e2e/**"],
    globals: false,
  },
});
