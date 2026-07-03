import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Panda CSS runs through PostCSS (postcss.config.cjs), so it needs no Vite
// plugin here. Local-only for now — the alchemy() Cloudflare plugin from
// stochastic-v3 gets added when we wire up deploy.
export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart(),
    viteReact({
      babel: { plugins: ["babel-plugin-react-compiler"] },
    }),
  ],
});
