import { defineConfig } from "drizzle-kit";

// Dormant until we go to Cloudflare: `drizzle-kit generate` will emit D1
// migrations into ./migrations (the dir alchemy.run.ts points D1 at).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/entities/db/schema.ts",
  out: "./migrations",
});
