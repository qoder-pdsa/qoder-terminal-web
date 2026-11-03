import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { isSyntheticBuild } from "./src/api/buildMode";

// Preview builds (deploy.sh preview -> Dockerfile.preview) inject VITE_BASE=/preview/<slug>/ but
// never VITE_SYNTHETIC; set it here so vite injects the flag and the dead real-fetch paths drop out
// of the published bundle. Default builds and tests leave the variable untouched, so
// vi.stubEnv("VITE_SYNTHETIC", "1") still works.
if (isSyntheticBuild(process.env.VITE_SYNTHETIC, process.env.VITE_BASE)) process.env.VITE_SYNTHETIC = "1";

export default defineConfig({
  // Per-branch previews are served under /preview/<slug>/ (deploy/deploy.sh preview); production keeps "/"
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: { port: 5173 },
  test: { include: ["src/**/*.test.ts"] },
});
