import path from "node:path";
import { defineConfig } from "vitest/config";

// Stesso alias "@/*" -> "src/*" definito in tsconfig.json, per riusare gli
// stessi import nei test senza percorsi relativi fragili.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
