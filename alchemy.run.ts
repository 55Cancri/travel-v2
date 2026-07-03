import alchemy from "alchemy";
import { D1Database, DurableObjectNamespace, TanStackStart } from "alchemy/cloudflare";

// Ported from stochastic-v3, trimmed to what travel-2 needs. NOT DEPLOYED YET —
// local dev runs plain `vite dev` with localStorage mock data. When we flip to
// Cloudflare: `alchemy deploy --env-file .env` (needs ALCHEMY_PASSWORD +
// SESSION_SECRET in .env), export TripRoom from a src/server.ts worker entry,
// and add the alchemy() plugin to vite.config.ts.

// stage drives resource names and the public workers.dev URL. Pin it to "prod"
// (override with STAGE=beta etc.) — never Alchemy's fallback (the OS username).
// password encrypts secret bindings in Alchemy state; must stay stable.
const req = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env before deploying.`);
  }
  return value;
};

for (const name of ["SESSION_SECRET"]) {
  req(name);
}

const app = await alchemy("travel2", {
  stage: process.env.STAGE ?? "prod",
  password: req("ALCHEMY_PASSWORD"),
});

export const db = await D1Database("db", {
  name: `${app.name}-${app.stage}-db`,
  migrationsDir: "migrations",
  // adopt: take over an existing resource of this name instead of erroring —
  // keeps redeploys idempotent
  adopt: true,
});

// One Durable Object per trip: the sync serialization point. Applies mutations
// to D1, stamps sequence numbers, and fans changes out over WebSocket to the
// other client. SQLite-backed (the only DO flavor the free plan allows). The
// class must be exported from the worker entry (src/server.ts) when it lands.
export const tripRoom = DurableObjectNamespace("trip-room", {
  className: "TripRoom",
  sqlite: true,
});

// R2 (offline map tiles now, voice-diary audio later) — enable with:
// export const tiles = await R2Bucket("tiles", {
//   name: `${app.name}-${app.stage}-tiles`,
//   adopt: true,
// });

export const website = await TanStackStart("website", {
  // worker name = public URL host: travel2-prod.<subdomain>.workers.dev
  name: `${app.name}-${app.stage}`,
  bindings: {
    DB: db,
    TRIP_ROOM: tripRoom,
    APP_URL: req("APP_URL"),
    SESSION_SECRET: alchemy.secret.env.SESSION_SECRET,
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
