// @vitest-environment node
// THE DISPLAYS' RUNTIME GRAPH TAKES THE EDIT VALUES FROM THE HOST'S LEAF
// (cinatra#3426).
//
// `src/artifact-edit-channel.ts` names the SDK leaf
// `@cinatra-ai/sdk-extensions/artifact-edit-channel` as the source of truth and
// itself as a structural copy, kept for this repository's own standalone
// typecheck and test run. The display already reaches that leaf for the save;
// taking the two RUNTIME values it needs (the idle pause and the grant test)
// from the same leaf, and the type names from the copy in a statement-level
// `import type` (erased, never loaded), keeps the copy out of the graph a host
// loads for the displays.
//
// THE WALK follows the shape of the package-root walk in
// `one-sanitizer.test.ts`, read as STATEMENTS rather than lines: every relative
// `import … from`, `export … from`, side-effect `import "…"` and dynamic
// `import("…")` is an edge a bundler follows — including `import { type A }`,
// which keeps the module under `verbatimModuleSyntax` — and only a
// statement-level `import type` / `export type` is erased.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type * as copy from "../src/artifact-edit-channel";
import type * as leaf from "@cinatra-ai/sdk-extensions/artifact-edit-channel";

// The leaf's two values keep the copy's EXACT types (the idle pause is the
// literal the copy and the leaf both infer, not a widened number). Checked by
// the typecheck, which resolves the leaf to ./types when no SDK is installed.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const pauseTypeMatchesCopy: Same<
  typeof leaf.ARTIFACT_EDIT_IDLE_PAUSE_MS,
  typeof copy.ARTIFACT_EDIT_IDLE_PAUSE_MS
> = true;
const grantTypeMatchesCopy: Same<typeof leaf.isArtifactEditGranted, typeof copy.isArtifactEditGranted> = true;

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const EDIT_LEAF = "@cinatra-ai/sdk-extensions/artifact-edit-channel";
const LOCAL_COPY = `${SRC}/artifact-edit-channel.ts`;
const DISPLAY_ENTRIES = [`${SRC}/renderers/detail.tsx`, `${SRC}/renderers/preview.tsx`];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sources(SRC);

interface Edge {
  statement: string;
  specifier: string;
  erased: boolean;
}

/** Every module edge a file declares, as statements. */
function edges(body: string): Edge[] {
  const found: Edge[] = [];
  for (const m of body.matchAll(
    /(?:^|\n)\s*((?:import|export)\b(?:(?!;)[\s\S])*?\bfrom\s*["'`]([^"'`]+)["'`])/g,
  )) {
    found.push({
      statement: m[1],
      specifier: m[2],
      erased: /^(?:import|export)\s+type\b/.test(m[1]),
    });
  }
  for (const m of body.matchAll(/(?:^|\n)\s*(import\s*["'`]([^"'`]+)["'`])/g)) {
    found.push({ statement: m[1], specifier: m[2], erased: false });
  }
  for (const m of body.matchAll(/\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    found.push({ statement: m[0], specifier: m[1], erased: false });
  }
  return found;
}

function resolveRelative(from: string, specifier: string): string | undefined {
  const base = from.slice(0, from.lastIndexOf("/"));
  const parts = `${base}/${specifier}`.split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") {
      if (out.length === 0) out.push("");
      continue;
    }
    if (part === "..") out.pop();
    else out.push(part);
  }
  const joined = out.join("/");
  return [`${joined}.ts`, `${joined}.tsx`, joined].find((c) => files.includes(c));
}

/** The package modules a host loads when it loads the display entries. */
function runtimeGraph(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const edge of edges(readFileSync(file, "utf8"))) {
      if (edge.erased || !edge.specifier.startsWith(".")) continue;
      const resolved = resolveRelative(file, edge.specifier);
      if (resolved) queue.push(resolved);
    }
  }
  return seen;
}

describe("the displays' runtime graph", () => {
  it("walks somewhere — the display entries reach the tabbed display", () => {
    const graph = runtimeGraph(DISPLAY_ENTRIES);
    expect(graph.has(`${SRC}/renderers/markdown-tabs.tsx`)).toBe(true);
    expect(graph.size).toBeGreaterThan(4);
  });

  it("does NOT load the local structural copy of the edit channel", () => {
    const graph = runtimeGraph(DISPLAY_ENTRIES);
    const reachedBy = [...graph].filter((file) =>
      edges(readFileSync(file, "utf8")).some(
        (edge) =>
          !edge.erased &&
          edge.specifier.startsWith(".") &&
          resolveRelative(file, edge.specifier) === LOCAL_COPY,
      ),
    );
    expect(reachedBy, `loaded by ${reachedBy.join(", ")}`).toEqual([]);
    expect(graph.has(LOCAL_COPY)).toBe(false);
  });

  it("takes the idle pause and the grant test from the host's leaf", () => {
    const tabs = readFileSync(`${SRC}/renderers/markdown-tabs.tsx`, "utf8");
    const fromLeaf = edges(tabs).filter((edge) => edge.specifier === EDIT_LEAF && !edge.erased);
    expect(fromLeaf).toHaveLength(1);
    for (const name of ["saveArtifactEdit", "ARTIFACT_EDIT_IDLE_PAUSE_MS", "isArtifactEditGranted"]) {
      expect(new RegExp(`\\b${name}\\b`).test(fromLeaf[0].statement), name).toBe(true);
    }
    // The type names still come from the copy — erased, never loaded.
    const fromCopy = edges(tabs).filter((edge) => edge.specifier === "../artifact-edit-channel");
    expect(fromCopy.length).toBeGreaterThan(0);
    for (const edge of fromCopy) expect(edge.erased, edge.statement).toBe(true);
  });

  it("declares the leaf's two values with the copy's exact types", () => {
    expect([pauseTypeMatchesCopy, grantTypeMatchesCopy]).toEqual([true, true]);
  });

  it("leaves the package root exporting the copy's values unchanged", () => {
    const root = readFileSync(`${SRC}/index.ts`, "utf8");
    const rootEdge = edges(root).find((edge) => edge.specifier === "./artifact-edit-channel");
    expect(rootEdge?.erased).toBe(false);
    for (const name of ["ARTIFACT_EDIT_IDLE_PAUSE_MS", "isArtifactEditGranted"]) {
      expect(new RegExp(`\\b${name}\\b`).test(rootEdge?.statement ?? ""), name).toBe(true);
    }
  });
});
