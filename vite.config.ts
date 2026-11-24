import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { isDemoPreviewBase, noBackendPath } from "./src/api/demoPreview";

// Per-branch previews are served under /preview/<slug>/ (deploy/deploy.sh preview); production keeps "/"
const base = process.env.VITE_BASE || "/";

// The deployment host builds previews with its own older tooling, which hardcodes the shared backend's
// URLs and offers no isolated mode. This work item's demo preview must run on its built-in demo data only,
// so a build under one of its own preview slugs marks itself isolated and points both business URLs at a
// path inside the preview, which the gateway serves statically. No host or gateway change is involved, and
// every other base — production "/", `make dev`, another branch's preview — keeps its configured URLs.
if (isDemoPreviewBase(base)) {
  process.env.VITE_ISOLATED_DEMO = "1";
  process.env.VITE_DATA_URL = noBackendPath(base);
  process.env.VITE_ANALYST_URL = noBackendPath(base);
}

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
  test: { include: ["src/**/*.test.ts"] },
});
