import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { emitsSyntheticApi, syntheticAssets } from "./preview/synthetic";

/**
 * A preview bundle carries its own synthetic API (workitem 10082): the production gateway that serves
 * /preview/<slug>/ proxies /api/* to the real services, and a preview must never reach them, so the fixtures
 * are emitted next to the bundle and the app resolves its API base inside the preview. Production builds emit
 * nothing and keep the configured backend.
 */
function previewSyntheticApi(): Plugin {
  let base = "/";
  return {
    name: "preview-synthetic-api",
    configResolved(config) {
      base = config.base;
    },
    generateBundle() {
      if (!emitsSyntheticApi(base)) return;
      for (const asset of syntheticAssets()) {
        this.emitFile({ type: "asset", fileName: asset.fileName, source: asset.source });
      }
    },
  };
}

export default defineConfig({
  // Per-branch previews are served under /preview/<slug>/ (deploy/deploy.sh preview); production keeps "/"
  base: process.env.VITE_BASE || "/",
  plugins: [react(), previewSyntheticApi()],
  server: { port: 5173 },
  test: { include: ["src/**/*.test.ts", "preview/**/*.test.ts"] },
});
