import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import alchemy from "alchemy";
import { Ai, D1Database, KVNamespace, TanStackStart } from "alchemy/cloudflare";

// The app's Cloudflare shape. `bun run dev` serves local dev with real
// bindings; `bun run deploy` ships to workers.dev. Both scripts execute
// this file directly under NODE, not through the alchemy CLI: the CLI
// picks bun from the lockfile and bun (1.3.14) segfaults running this
// entrypoint. Deploys pass --force because a code-only change does not
// invalidate the website-build resource and would otherwise ship the
// previous bundle. Secrets and auth live in .env (.env.example documents
// them).

// stage drives resource names and the public workers.dev URL. Pin it to
// "prod" (override with STAGE=beta etc.), never Alchemy's fallback (the OS
// username). password encrypts secret bindings in Alchemy state; must stay
// stable.
const req = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env before deploying.`);
  }
  return value;
};

for (const name of ["SESSION_SECRET", "ALLOWED_EMAILS", "APP_PASSWORD"]) {
  req(name);
}

const stage = process.env.STAGE ?? "prod";

const app = await alchemy("travel2", {
  stage,
  password: req("ALCHEMY_PASSWORD"),
  // Stage-private state tree: alchemy's finalize orphan-destroys any sibling
  // scope it can see in a shared state store, so a dev-stage run against a
  // shared .alchemy/ could delete the prod worker. The option is honored at
  // runtime but missing from the public options type, hence the cast.
  ...({ dotAlchemy: path.resolve(import.meta.dirname, ".alchemy", stage) } as object),
});

export const db = await D1Database("db", {
  name: `${app.name}-${app.stage}-db`,
  migrationsDir: "migrations",
  // adopt: take over an existing resource of this name instead of erroring,
  // which keeps redeploys idempotent
  adopt: true,
});

// One Durable Object per trip: the sync serialization point. Applies mutations
// to D1, stamps sequence numbers, and fans changes out over WebSocket to the
// other client. SQLite-backed (the only DO flavor the free plan allows).
// Enable when the sync feature lands; a bound namespace without its exported
// class fails the deploy:
// export const tripRoom = DurableObjectNamespace("trip-room", {
//   className: "TripRoom",
//   sqlite: true,
// });

// R2 (offline map tiles now, voice-diary audio later), enable with:
// export const tiles = await R2Bucket("tiles", {
//   name: `${app.name}-${app.stage}-tiles`,
//   adopt: true,
// });

// Workers AI: the curation model behind /api/curate (ranking map sights
// against the plan's own taste). Rides the free plan's daily allocation.
// It is the one binding with no local emulation: dev proxies it to the
// real service, which needs Cloudflare credentials (an API token or a
// prior `wrangler login`). A credential-less machine still serves local
// dev with the binding left out; /api/curate then fails and the client's
// notability heuristic answers instead, the endpoint's designed
// degradation. Deploys NEVER stand the binding down: the probe below is
// a heuristic, and a deploy authenticated some way it cannot see must
// fail loudly rather than silently ship prod without AI.
const wranglerLoginOnDisk = [
  path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), ".wrangler", "config", "default.toml"),
  path.join(os.homedir(), ".wrangler", "config", "default.toml"),
  path.join(os.homedir(), "Library", "Preferences", ".wrangler", "config", "default.toml"),
].some((file) => fs.existsSync(file));
const devRun = process.argv.includes("--dev");
const aiReachable =
  !devRun ||
  Boolean(process.env.CLOUDFLARE_API_TOKEN) ||
  Boolean(process.env.CLOUDFLARE_API_KEY) ||
  wranglerLoginOnDisk;
if (!aiReachable) {
  console.warn("[alchemy] no Cloudflare credentials: serving dev without the Workers AI binding");
}
export const ai = Ai();

// Response cache for external place providers (Yelp, Foursquare, Google
// Places): identical viewport queries answer from KV instead of burning
// each provider's small free quota.
export const placeCache = await KVNamespace("place-cache", {
  title: `${app.name}-${app.stage}-place-cache`,
  adopt: true,
});

export const website = await TanStackStart("website", {
  // worker name = public URL host: travel-v2.<subdomain>.workers.dev. Only
  // stage prod owns the bare name; other stages get their own worker so a
  // non-prod run can never adopt or delete the live one.
  name: app.stage === "prod" ? "travel-v2" : `travel-v2-${app.stage}`,
  bindings: {
    DB: db,
    ...(aiReachable ? { AI: ai } : {}),
    PLACE_CACHE: placeCache,
    SESSION_SECRET: alchemy.secret.env.SESSION_SECRET,
    GOOGLE_PLACES_API_KEY: alchemy.secret.env.GOOGLE_PLACES_API_KEY,
    ALLOWED_EMAILS: alchemy.secret.env.ALLOWED_EMAILS,
    APP_PASSWORD: alchemy.secret.env.APP_PASSWORD,
  },
  adopt: true,
  // Persist request logs + exceptions to Cloudflare Workers Logs so a prod 500
  // is diagnosable after the fact.
  observability: { enabled: true },
  dev: {
    command: "vite dev --port 5006",
  },
});

console.log({ url: website.url });

await app.finalize();
