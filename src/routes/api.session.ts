import { createFileRoute } from "@tanstack/react-router";
import { admit, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./-door";

// Login: an allowed email plus the shared password becomes a sealed
// 90-day cookie. Failures answer identically whether the email is
// unknown or the password wrong.

export const Route = createFileRoute("/api/session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { email?: string; password?: string };
        const token = await admit(
          String(body.email ?? "").slice(0, 200),
          String(body.password ?? "").slice(0, 200),
        );
        if (!token) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie":
              `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; ` +
              `SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
          },
        });
      },
    },
  },
});
