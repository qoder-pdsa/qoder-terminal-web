import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Per-branch previews are served under /preview/<slug>/ (deploy/deploy.sh preview); production keeps "/"
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: { port: 5173 },
  test: { include: ["src/**/*.test.ts"] },
});
