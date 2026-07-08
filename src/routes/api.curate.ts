import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { sessionFromRequest } from "./-door";

// The Suggested overlay's curator: given the plan's own item texts and
// the viewport's candidate sights, the model picks what this traveler
// would actually want to see. The client keeps its notability heuristic
// as the fallback whenever this endpoint cannot answer, so a failure
// here degrades quality, never availability.

type WireCandidate = {
  id: string;
  name: string;
  category?: string;
  notable?: boolean;
};

// Small instruct model: ranking two dozen names is not a reasoning task,
// and the free Workers AI allocation goes further on it.
const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const CANDIDATE_CAP = 120;
const PLAN_CAP = 100;
const PICK_CAP = 25;

const jsonBody = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Workers AI hands back `response` already parsed when the model answers
// pure JSON, and prose-wrapped text when it does not; both shapes carry
// the same contract (a JSON array of ids), so both parse here.
const parseIds = (payload: unknown): string[] | null => {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof payload !== "string") return null;
  const match = payload.match(/\[[\s\S]*?\]/);
  if (!match) return null;
  try {
    return parseIds(JSON.parse(match[0]));
  } catch {
    return null;
  }
};

export const Route = createFileRoute("/api/curate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Everything surfaces as JSON with the real reason: the framework's
        // bare fallback for an uncaught throw is an opaque 500.
        try {
          if ((await sessionFromRequest(request)) === null) {
            return jsonBody({ error: "signed out" }, 401);
          }
          return await curate(request);
        } catch (error) {
          console.error("[curate] failed:", error);
          return jsonBody(
            {
              error: `curate failed: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
            },
            502,
          );
        }
      },
    },
  },
});

async function curate(request: Request) {
  if (!("AI" in env) || !env.AI) {
    return jsonBody({ error: "curation model unavailable" }, 501);
  }
  const body = (await request.json()) as {
    plan?: string[];
    candidates?: WireCandidate[];
  };
  const plan = (body.plan ?? []).slice(0, PLAN_CAP);
  const candidates = (body.candidates ?? []).slice(0, CANDIDATE_CAP);
  if (!candidates.length) return jsonBody({ picks: [] });
  const roster = candidates
    .map(
      (entry) =>
        `${entry.id} | ${entry.name}${entry.category ? ` (${entry.category})` : ""}${entry.notable ? " [notable]" : ""}`,
    )
    .join("\n");
  const result = (await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You curate sightseeing suggestions for a traveler. From the candidate list, pick the places this traveler would most enjoy, judging by the taste their existing plan reveals. Prefer well-known landmarks over minor entries when taste gives no signal. Answer with ONLY a JSON array of the chosen candidate ids, best first, at most " +
          `${PICK_CAP} ids.`,
      },
      {
        role: "user",
        content: `Their current plan:\n${plan.join("\n")}\n\nCandidates (id | name):\n${roster}`,
      },
    ],
    max_tokens: 600,
  })) as { response?: unknown };
  const known = new Set(candidates.map((entry) => entry.id));
  const picks = (parseIds(result.response) ?? [])
    .filter((id) => known.has(id))
    .slice(0, PICK_CAP);
  if (!picks.length) {
    return jsonBody({ error: "curation answer unusable" }, 502);
  }
  return jsonBody({ picks });
}
