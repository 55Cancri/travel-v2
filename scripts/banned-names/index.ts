// Deterministic guard for the banned-word naming rules: scans TypeScript
// DECLARATION sites (plus file and folder names) for identifiers built on
// the banned stems, and fails with a file:line listing when any slip in.
// Word boundaries are camel humps, underscores, and hyphens, so Statement,
// score, and translate never false-positive. External API surfaces are
// exempt by construction: only names introduced by a declaration keyword
// are checked, never property reads or imported names we do not own.
//
// A tripwire, not a proof: regex sees keyword-led declarations and
// destructuring, but not function parameters, type fields, or names
// inside multiline block comments. Full conformance needs an AST walk.
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
    .split(/[_\s$-]+/)
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
    // Comments and strings are prose, not identifiers. Stripping runs per
    // line (backticks included, so single-line templates never false-
    // positive), then the stripped lines rejoin so destructuring patterns
    // that span lines still match.
    const stripped = readFileSync(file, "utf8")
      .split("\n")
      .map((line) =>
        line
          .replace(/\/\/.*$/, "")
          .replace(/"[^"]*"/g, '""')
          .replace(/'[^']*'/g, "''")
          .replace(/`[^`]*`/g, '""'),
      );
    const lineAt = (text: string, at: number) => text.slice(0, at).split("\n").length;
    const joined = stripped.join("\n");
    const flag = (name: string, line: number) => {
      const hits = stemHits(name);
      if (hits.length > 0) faults.push(`${file}:${line}: "${name}" carries: ${hits.join(", ")}`);
    };
    stripped.forEach((code, i) => {
      for (const decl of [TS_DECL, TS_TYPE_DECL]) {
        decl.lastIndex = 0;
        for (let hit = decl.exec(code); hit !== null; hit = decl.exec(code)) flag(hit[1]!, i + 1);
      }
    });
    TS_PATTERN_DECL.lastIndex = 0;
    for (let hit = TS_PATTERN_DECL.exec(joined); hit !== null; hit = TS_PATTERN_DECL.exec(joined)) {
      // In object patterns only the LOCAL side is ours: `{ data: rows }`
      // declares rows, not data. A rest element's dots are not part of
      // the name it declares.
      for (const part of hit[1]!.slice(1, -1).split(",")) {
        const bare = part.replace(/^\s*\.\.\./, "");
        const local = (bare.includes(":") ? bare.split(":").at(-1)! : bare).trim();
        const name = /^([A-Za-z_$][\w$]*)/.exec(local)?.[1];
        if (name) flag(name, lineAt(joined, hit.index));
      }
    }
  }
}

if (faults.length > 0) {
  console.error(`banned names (${faults.length}):`);
  for (const fault of faults) console.error(`  ${fault}`);
  process.exit(1);
}
console.log("banned-names: clean");
