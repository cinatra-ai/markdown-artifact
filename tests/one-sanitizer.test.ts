// @vitest-environment node
// ONE SANITIZER IN THE FLEET. This package draws markdown through the SDK's
// sanitizer leaf entry and carries no sanitization of its own — no parser, no
// escaping, no scheme allow-list, no tag stripping.
//
// THESE ARE HEURISTICS OVER THE PACKAGE'S OWN SOURCES, and worth exactly that:
// they catch a second implementation added the ordinary way — an import, an
// escape, another road from a string to markup — and they do not catch one
// somebody set out to hide. Their value is that the ordinary way is how it
// would actually happen.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const SANITIZER_SPECIFIER = "@cinatra-ai/sdk-extensions/markdown-sanitizer";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("the package draws through the one shared sanitizer", () => {
  const files = sources(SRC);

  it("imports the sanitizer at its leaf specifier, in exactly one module", () => {
    const importers = files.filter((f) => readFileSync(f, "utf8").includes(SANITIZER_SPECIFIER));
    expect(importers).toHaveLength(1);
    expect(importers[0].endsWith("/renderers/markdown-view.ts")).toBe(true);
  });

  it("imports no markdown parser and no html sanitizer this guard knows of", () => {
    // Quoting-agnostic and package-agnostic: any import of a markdown parser or
    // an html sanitizer, however it is spelled.
    const forbidden =
      /(marked|markdown-it|remark|rehype|micromark|commonmark|showdown|snarkdown|markdown|dompurify|sanitize-html|xss|insane|purify)/i;
    for (const file of files) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        // `from "x"`, `import "x"`, `require("x")` AND `import("x")` — a
        // dynamic import is an import.
        const specifier = /(?:from|import|require)\s*\(?\s*["'`]([^"'`]+)["'`]/.exec(line)?.[1];
        // Only BARE specifiers name a package; a relative path is this
        // package's own module and is covered by the other guards here.
        if (!specifier || specifier.startsWith(".") || specifier.startsWith("/")) continue;
        // The ONE sanitizer this package may import is the shared leaf entry.
        if (specifier === SANITIZER_SPECIFIER) continue;
        expect(forbidden.test(specifier), `${file}: ${line.trim()}`).toBe(false);
      }
    }
  });

  it("writes none of the escaping, stripping or scheme-checking this guard knows of", () => {
    // A sanitizer smuggled in as "just a little escaping" is still a second
    // sanitizer, and it is the one that will be wrong.
    const smells = [
      /replace\s*\(\s*\/&\//,
      /&(amp|lt|gt|quot|#0?39);/,
      /<\s*\/?\s*script/i,
      /javascript\s*:/i,
      /\bon(?:error|load|click)\b\s*=/i,
      /\bhttps?:\s*["'`]/,
      /replaceAll\s*\(/,
      /encodeURI(Component)?\s*\(/,
      /new\s+URL\s*\(/,
    ];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      for (const smell of smells) {
        expect(smell.test(body), `${file} matches ${smell}`).toBe(false);
      }
    }
  });

  it("declares no runtime dependency at all, and no parser in any dependency list", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies ?? {}).toEqual({});
    const named = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];
    for (const dep of named) {
      expect(
        /(marked|markdown|remark|rehype|micromark|showdown|dompurify|sanitize-html|purify|xss)/i.test(dep),
        dep,
      ).toBe(false);
    }
  });

  it("the package ROOT reaches the sanitizer through NO module, at any depth", () => {
    // Not a syntax check: walk the root's own relative imports transitively —
    // a compiler follows a type re-export into the module it names — and prove
    // that nothing reachable from the root names the host-provided sanitizer.
    // This is what keeps the root importable and typecheckable with nothing
    // installed.
    const seen = new Set<string>();
    const queue = [`${SRC}/index.ts`];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const body = readFileSync(file, "utf8");
      expect(body.includes(SANITIZER_SPECIFIER), `${file} is reachable from the root`).toBe(false);
      for (const match of body.matchAll(/(?:from|import|require)\s*\(?\s*["'`](\.[^"'`]+)["'`]/g)) {
        const rel = match[1].replace(/^\.\//, "");
        const base = file.slice(0, file.lastIndexOf("/"));
        const candidates = [
          `${base}/${rel}.ts`,
          `${base}/${rel}.tsx`,
          `${base}/${rel}`,
        ];
        const resolved = candidates.find((c) => files.includes(c));
        if (resolved) queue.push(resolved);
      }
    }
    // The walk must actually have walked somewhere, or it proves nothing.
    expect(seen.size).toBeGreaterThan(2);
  });

  it("the package root names a renderer module in TYPE position only", () => {
    // Read as STATEMENTS, not as lines: a re-export spanning several lines is
    // still one statement, and it is the statement that either erases at build
    // time or loads a module.
    const root = readFileSync(`${SRC}/index.ts`, "utf8");
    const statements = [
      ...root.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["'`](\.[^"'`]+)["'`]/g),
    ];
    const rendererStatements = statements.filter((m) => m[1].includes("/renderers/"));
    expect(rendererStatements.length).toBeGreaterThan(0);
    for (const statement of rendererStatements) {
      expect(/\b(import|export)\s+type\b/.test(statement[0]), statement[0].trim()).toBe(true);
    }
  });

  it("injects html in exactly ONE place, ONCE, by no other road this guard knows of", () => {
    // Every way a string becomes markup in a page, counted per file: one
    // injection, in the component that owns the document container.
    const roads =
      /dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|new\s+DOMParser|srcDoc|srcdoc/g;
    const counts = new Map<string, number>();
    for (const file of files) {
      const hits = readFileSync(file, "utf8").match(roads) ?? [];
      if (hits.length > 0) counts.set(file, hits.length);
    }
    expect([...counts.keys()]).toHaveLength(1);
    const [file, count] = [...counts.entries()][0];
    expect(file.endsWith("/renderers/markdown-document.tsx")).toBe(true);
    expect(count).toBe(1);
  });
});
