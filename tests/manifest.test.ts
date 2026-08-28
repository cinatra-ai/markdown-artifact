// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { markdownArtifactManifest } from "../src/index";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as {
  name: string;
  files: string[];
  exports: Record<string, unknown>;
  cinatra: {
    apiVersion: string;
    kind: string;
    displayName: string;
    vendor: { key: string; name: string };
    dependencies: unknown[];
    artifact: {
      accepts: { file: { mimeTypes: string[] } };
      ui: {
        abiVersion: number;
        sdkAbiRange: string;
        renderers: Record<string, { entry: string; propsApiVersion: number; representations?: string[] }>;
      };
      objectTypes: Array<{
        type: string;
        claim: string;
        dispositions: Record<string, unknown>;
        schema: Record<string, unknown>;
      }>;
    };
  };
};

const MIMES = ["text/markdown"];

const ARTIFACT_ALLOWED_CINATRA_KEYS = new Set([
  "kind",
  "apiVersion",
  "artifact",
  "dependencies",
  "roles",
  "displayName",
  "vendor",
]);
const ARTIFACT_UI_RENDERER_ALLOWED_KEYS = new Set(["entry", "propsApiVersion", "representations"]);

/** The key the host's manifest generator derives from a renderer entry: the
 * entry path minus its source extension. A display is published only at THIS
 * key — the generator refuses to generate when nothing resolves it. */
function generatorExportsKeyForEntry(entry: string): string {
  return `./${entry.replace(/^\.\//, "").replace(/\.(ts|tsx)$/, "")}`;
}

describe("package.json manifest — the system-base markdown identity", () => {
  it("names the package per the @cinatra-ai/<slug>-artifact convention", () => {
    expect(pkg.name).toBe("@cinatra-ai/markdown-artifact");
  });

  it("declares the first-party artifact identity", () => {
    expect(pkg.cinatra.kind).toBe("artifact");
    expect(pkg.cinatra.apiVersion).toBe("cinatra.ai/v1");
    expect(pkg.cinatra.displayName).toBe("Markdown");
    expect(pkg.cinatra.vendor).toEqual({ key: "cinatra-ai", name: "Cinatra" });
  });

  it("omits dependency edges (a system base is platform-guaranteed)", () => {
    expect(pkg.cinatra.dependencies).toEqual([]);
  });

  it("declares only the allowed top-level cinatra.* keys", () => {
    for (const k of Object.keys(pkg.cinatra)) {
      expect(ARTIFACT_ALLOWED_CINATRA_KEYS.has(k)).toBe(true);
    }
    expect("skills" in pkg.cinatra.artifact).toBe(false);
  });

  it("ACCEPTS text/markdown ALONE — not plain text, not csv, nothing else", () => {
    expect(pkg.cinatra.artifact.accepts.file.mimeTypes).toEqual(MIMES);
    for (const m of pkg.cinatra.artifact.accepts.file.mimeTypes) {
      expect(m.includes("*")).toBe(false);
    }
    for (const foreign of ["text/plain", "text/csv", "text/html", "application/octet-stream"]) {
      expect(pkg.cinatra.artifact.accepts.file.mimeTypes).not.toContain(foreign);
    }
  });

  it("declares a strict v1 ui block bound to the generated host SDK ABI range", () => {
    const ui = pkg.cinatra.artifact.ui;
    expect(ui.abiVersion).toBe(1);
    expect(ui.sdkAbiRange).toBe("^2.5.0");
  });

  it("declares BOTH the detail and the preview display, each bound to markdown", () => {
    const renderers = pkg.cinatra.artifact.ui.renderers;
    expect(Object.keys(renderers).sort()).toEqual(["detail", "preview"]);
    // Each slot names ITS OWN entry — swapping the two would pass every other
    // assertion here, and would mount the wrong module in each surface.
    expect(renderers.detail.entry).toBe("./src/renderers/detail.tsx");
    expect(renderers.preview.entry).toBe("./src/renderers/preview.tsx");
    for (const renderer of Object.values(renderers)) {
      expect(renderer.representations).toEqual(MIMES);
      expect(renderer.propsApiVersion).toBe(1);
      for (const k of Object.keys(renderer)) {
        expect(ARTIFACT_UI_RENDERER_ALLOWED_KEYS.has(k)).toBe(true);
      }
    }
  });

  it("points every renderer entry at a package-contained subpath that exists", () => {
    for (const renderer of Object.values(pkg.cinatra.artifact.ui.renderers)) {
      expect(renderer.entry.startsWith("./src/")).toBe(true);
      expect(renderer.entry.includes("..")).toBe(false);
      const resolved = fileURLToPath(new URL(`../${renderer.entry.slice(2)}`, import.meta.url));
      expect(() => readFileSync(resolved, "utf8")).not.toThrow();
    }
  });

  it("declares exactly one dedicated objectTypes claim for the upload type map", () => {
    const claims = pkg.cinatra.artifact.objectTypes;
    expect(Array.isArray(claims)).toBe(true);
    expect(claims).toHaveLength(1);
    const claim = claims[0];
    expect(claim.type).toBe("@cinatra-ai/markdown-artifact:artifact");
    expect(claim.claim).toBe("dedicated");
    expect(claim.dispositions).toEqual({
      projection: "artifact-safe",
      pinnable: false,
      snapshotPolicy: "none",
      sensitivity: "normal",
    });
    expect(claim.schema).toEqual({ type: "object" });
  });

  it("keeps the typed src manifest in agreement with package.json", () => {
    expect(markdownArtifactManifest.accepts).toEqual(pkg.cinatra.artifact.accepts);
    expect(markdownArtifactManifest.ui).toEqual(pkg.cinatra.artifact.ui);
  });
});

describe("package.json exports — the display is published by the package itself", () => {
  it("declares an exports subpath map (never a bare sugar target)", () => {
    expect(typeof pkg.exports).toBe("object");
    expect(Array.isArray(pkg.exports)).toBe(false);
    for (const key of Object.keys(pkg.exports)) {
      expect(key.startsWith(".")).toBe(true);
    }
  });

  it("publishes EVERY declared renderer at the generator's key", () => {
    for (const renderer of Object.values(pkg.cinatra.artifact.ui.renderers)) {
      const key = generatorExportsKeyForEntry(renderer.entry);
      expect(Object.keys(pkg.exports)).toContain(key);
      expect(pkg.exports[key]).toBe(renderer.entry);
    }
  });

  it("names no PATTERN subpath — the imported specifier is never a function of an internal path", () => {
    for (const key of Object.keys(pkg.exports)) {
      expect(key.includes("*")).toBe(false);
    }
  });

  it("resolves every display through a PORTABLE target, never behind a node-only condition", () => {
    for (const renderer of Object.values(pkg.cinatra.artifact.ui.renderers)) {
      const target = pkg.exports[generatorExportsKeyForEntry(renderer.entry)];
      if (typeof target === "string") {
        expect(target.startsWith("./")).toBe(true);
      } else {
        const conditions = Object.keys(target as Record<string, unknown>);
        expect(conditions.some((c) => c === "import" || c === "default")).toBe(true);
      }
    }
  });

  it("keeps the package ROOT importable — an exports map closes every undeclared path", () => {
    // Introducing `exports` makes the map the WHOLE public surface: any subpath
    // it does not name stops resolving. "." is declared deliberately so the
    // root keeps resolving to the same module `main`/`types` name.
    expect(pkg.exports["."]).toBe("./src/index.ts");
    expect(pkg.exports["."]).toBe((pkg as unknown as { main: string }).main);
  });

  it("keeps every exports target inside the published files allowlist", () => {
    expect(pkg.files).toContain("src");
    for (const target of Object.values(pkg.exports)) {
      expect(typeof target).toBe("string");
      expect((target as string).startsWith("./src/")).toBe(true);
      const resolved = fileURLToPath(new URL(`../${(target as string).slice(2)}`, import.meta.url));
      expect(() => readFileSync(resolved, "utf8")).not.toThrow();
    }
  });
});
