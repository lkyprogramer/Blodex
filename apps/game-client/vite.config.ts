import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const coreEntry = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));
const contentEntry = fileURLToPath(new URL("../../packages/content/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@blodex/core": coreEntry,
      "@blodex/content": contentEntry
    },
    extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"]
  },
  server: {
    port: 5173
  }
});
