---
name: fallow-analysis
description: Analyze JavaScript and TypeScript code health with Fallow. Use after substantial JS/TS changes, when reviewing AI-generated code, or when the user asks about dead code, duplication, complexity, CRAP score, hotspots, or cleanup opportunities.
---

# Fallow Analysis

## Quick Run

Run from the workspace root that owns the code (`v1/`, `v2-3/`, or `v4/` —
there is no repo-root package.json), so that root's `.fallowrc.json` is
picked up:

```bash
bun run fallow:summary
bun run fallow:audit -- --changed-since main --format json --explain
bun run fallow:health -- --format json --explain
bun run fallow:dupes -- --format json
bun run fallow:dead-code -- --format json --explain
```

For changed-code review, start with `fallow:audit`. For broad cleanup or a risky refactor, run `fallow:summary`, then targeted `health`, `dupes`, and `dead-code`.

## How To Read Findings

- `health`: refactor functions above `maxCyclomatic`, `maxCognitive`, or `maxCrap`. Prefer simplifying control flow, splitting workflows into named stages, or adding tests when CRAP is driven by low coverage.
- `dupes`: merge repeated logic only when the shared abstraction has a real domain name. Do not create generic helpers just to reduce clone count.
- `dead-code`: delete high-confidence unused files/exports/dependencies. For public or runtime-only surfaces, model the reason in Fallow config or a narrow Fallow suppression.
- `audit`: changed-code gate. Treat introduced findings as blocking unless the user explicitly accepts the risk.

## Rules Of Engagement

- Do not blindly apply `fallow fix --yes`; run `fallow fix --dry-run` first and review the patch.
- Prefer code fixes over suppressions.
- Keep every suppression narrow and explain why in the commit or PR body.
- Re-run the same Fallow command after fixes and report the before/after counts.
