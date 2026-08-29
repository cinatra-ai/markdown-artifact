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
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      expect(body, file).not.toMatch(/from\s+"marked"/);
      expect(body, file).not.toMatch(/dompurify/i);
      expect(body, file).not.toMatch(/sanitize-html/);
    }
  });

  it("declares no dependency of its own on a markdown or sanitizing package", () => {
    const pkg = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("injects the sanitizer's html in exactly one place, and nowhere else", () => {
    const injectors = files.filter((f) =>
      readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"),
    );
    expect(injectors).toHaveLength(1);
    expect(injectors[0].endsWith("/renderers/markdown-document.tsx")).toBe(true);
  });
});
