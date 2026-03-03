import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Prefer source TS modules when sibling generated JS files exist.
    extensions: [".ts", ".tsx", ".mjs", ".js", ".json"]
  }
});
