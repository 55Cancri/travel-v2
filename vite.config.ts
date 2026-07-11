import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import alchemy from "alchemy/cloudflare/tanstack-start";
import { defineConfig, type PluginOption } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

// Panda CSS runs through PostCSS (postcss.config.cjs), so it needs no Vite
// plugin here. The alchemy() plugin targets the server build at the
// Cloudflare worker runtime and hands dev the emulated bindings; it needs
// the wrangler config that `alchemy dev` / `alchemy deploy` generate, so
// vite runs THROUGH those commands (the package scripts do). The one
// exception: once a dev run has generated .alchemy/local/wrangler.jsonc,
// a credential-less machine may serve `vite dev` directly against that
// config (the travel-2-local launch entry).
export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    alchemy() as PluginOption,
    tanstackStart(),
    viteReact({
      babel: { plugins: ["babel-plugin-react-compiler"] },
    }),
  ],
});
