// @vitest-environment node
// ONE SANITIZER IN THE FLEET. This package draws markdown through the SDK's
// sanitizer leaf entry and carries no sanitization of its own — no parser, no
// escaping, no scheme allow-list, no tag stripping. These assertions read the
// package's own sources, so a second implementation cannot be added quietly.

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

  it("pulls in no markdown parser and no sanitizer of its own", () => {
    // Quoting-agnostic and package-agnostic: any import of a markdown parser or
    // an html sanitizer, however it is spelled.
    const forbidden =
      /(marked|markdown-it|remark|rehype|micromark|commonmark|showdown|snarkdown|dompurify|sanitize-html|xss|xss-filters|insane|js-xss)/i;
    for (const file of files) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const specifier = /(?:from|import|require\()\s*["'`]([^"'`]+)["'`]/.exec(line)?.[1];
        if (!specifier) continue;
        expect(forbidden.test(specifier), `${file}: ${line.trim()}`).toBe(false);
      }
    }
  });

  it("writes no escaping, stripping or scheme-checking of its own", () => {
    // A sanitizer smuggled in as "just a little escaping" is still a second
    // sanitizer, and it is the one that will be wrong.
    const smells = [
      /replace\s*\(\s*\/&\//,
      /&(amp|lt|gt|quot|#0?39);/,
      /<\s*\/?\s*script/i,
      /javascript\s*:/i,
      /\bon(?:error|load|click)\b\s*=/i,
      /\bhttps?:\s*["'`]/,
    ];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      for (const smell of smells) {
        expect(smell.test(body), `${file} matches ${smell}`).toBe(false);
      }
    }
  });

  it("declares no dependency of its own on a markdown or sanitizing package", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("injects html in exactly ONE place, ONCE, and by no other road", () => {
    // Every way a string becomes markup in a page, counted per file: one
    // injection, in the component that owns the document container.
    const roads =
      /dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|new\s+DOMParser/g;
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
