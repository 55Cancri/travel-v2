// Deterministic guard for the banned-word naming rules: scans TypeScript
// DECLARATION sites (plus file and folder names) for identifiers built on
// the banned stems, and fails with a file:line listing when any slip in.
// Word boundaries are camel humps and underscores, so Statement, score,
// and translate never false-positive. External API surfaces are exempt by
// construction: only names introduced by a declaration keyword are
// checked, never property reads or imported names we do not own.
//
// Run from the repo root: bun scripts/banned-names/index.ts [paths...]
// No paths means the standard sweep (src).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Exact-name bans apply only when the identifier IS the word; stem bans
// also reject compounds (WeatherState, uploadManager, fooHelpers).
const STEMS = ["state", "shared", "manager", "handler", "helper", "helpers", "util", "utils", "common"];
const EXACT = ["data", "type", "core", "default", "defaults", "index"];

const SKIP_DIRS = new Set(["node_modules", "styled-system", "dist", ".alchemy", ".tanstack"]);
const SKIP_FILES = new Set(["routeTree.gen.ts"]);

// A declaration keyword introduces the name we own. Object/array patterns
// after const/let are walked too: destructured LOCAL names are ours (the
// setter from useState included).
const TS_DECL = /\b(?:const|let|var|function|class|interface|enum|namespace)\s+([A-Za-z_$][\w$]*)/g;
const TS_TYPE_DECL = /\btype\s+([A-Za-z_$][\w$]*)\s*[=<]/g;
const TS_PATTERN_DECL = /\b(?:const|let|var)\s*(\[[^\]]*\]|\{[^}]*\})\s*=/g;

const stemHits = (name: string) => {
  // Split the identifier into words on humps and underscores; a banned
  // stem must be a whole word, never a substring.
  const words = name
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[_\s$]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
  const found = words.filter((word) => STEMS.includes(word));
  if (EXACT.includes(name.toLowerCase())) found.push(name.toLowerCase());
  return found;
};

const walk = (dir: string, files: string[] = []) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(ts|tsx)$/.test(entry) && !SKIP_FILES.has(entry)) files.push(path);
  }
  return files;
};

const roots = process.argv.slice(2);
const targets = roots.length > 0 ? roots : ["src"];

const faults: string[] = [];
for (const root of targets) {
  const files = statSync(root).isDirectory() ? walk(root) : [root];
  for (const file of files) {
    // File and folder names follow the same rules as identifiers.
    for (const piece of relative(".", file).split("/")) {
      const bare = piece.replace(/\.(ts|tsx)$/, "");
      if (bare === "index") continue;
      const hits = stemHits(bare);
      if (hits.length > 0) faults.push(`${file}: path piece "${piece}" carries: ${hits.join(", ")}`);
    }
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      // Comments and strings are prose, not identifiers.
      const code = line.replace(/\/\/.*$/, "").replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
      const names: string[] = [];
      for (const decl of [TS_DECL, TS_TYPE_DECL]) {
        decl.lastIndex = 0;
        for (let hit = decl.exec(code); hit !== null; hit = decl.exec(code)) names.push(hit[1]!);
      }
      TS_PATTERN_DECL.lastIndex = 0;
      for (let hit = TS_PATTERN_DECL.exec(code); hit !== null; hit = TS_PATTERN_DECL.exec(code)) {
        // In object patterns only the LOCAL side is ours: `{ data: rows }`
        // declares rows, not data.
        for (const part of hit[1]!.slice(1, -1).split(",")) {
          const local = (part.includes(":") ? part.split(":").at(-1)! : part).trim();
          const name = /^([A-Za-z_$][\w$]*)/.exec(local)?.[1];
          if (name) names.push(name);
        }
      }
      for (const name of names) {
        const hits = stemHits(name);
        if (hits.length > 0) faults.push(`${file}:${i + 1}: "${name}" carries: ${hits.join(", ")}`);
      }
    });
  }
}

if (faults.length > 0) {
  console.error(`banned names (${faults.length}):`);
  for (const fault of faults) console.error(`  ${fault}`);
  process.exit(1);
}
console.log("banned-names: clean");
