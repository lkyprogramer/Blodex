import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Prefer source TS modules when sibling generated JS files exist.
    extensions: [".ts", ".tsx", ".mjs", ".js", ".json"]
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 75,
        branches: 60
      }
    }
  }
});
