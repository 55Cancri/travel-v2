// Worker binding types inferred from the Alchemy config: `env` from
// "cloudflare:workers" carries exactly what alchemy.run.ts binds (DB, AI,
// PLACE_CACHE, secrets), so schema drift between infra and server code is
// a type error. This file must stay a script (no top-level imports): a
// `declare module` inside a module file only augments, and augmenting a
// module that has no base declaration silently registers nothing. The
// module is declared by hand instead of pulling @cloudflare/workers-types
// into the global types array, whose globals redefine DOM builtins and
// break browser-side code in this shared tsconfig.

type CloudflareEnv = typeof import("../alchemy.run.ts").website.Env;

declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
}
