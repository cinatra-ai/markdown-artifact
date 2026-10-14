// @vitest-environment node
// The packaging half of the display: the SDK the display draws through is
// declared as the host-provided optional peer it is, and the props version the
// manifest publishes is the one the display actually accepts a snapshot at.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  MARKDOWN_DETAIL_PROPS_API_VERSION,
  MARKDOWN_DISPLAY_PROPS_API_VERSION,
} from "../src/renderers/markdown-view-contract";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as {
  peerDependencies: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  cinatra: {
    artifact: { ui: { renderers: Record<string, { propsApiVersion: number }> } };
  };
};

describe("the SDK the display draws through", () => {
  it("is declared as a peer, and an OPTIONAL one — the host provides it", () => {
    expect(pkg.peerDependencies["@cinatra-ai/sdk-extensions"]).toBeDefined();
    expect(pkg.peerDependenciesMeta?.["@cinatra-ai/sdk-extensions"]?.optional).toBe(true);
  });
});

describe("the declared props version", () => {
  it("is the version each published display entry declares", () => {
    const renderers = pkg.cinatra.artifact.ui.renderers;
    expect(Object.keys(renderers).length).toBeGreaterThan(0);
    for (const [slot, renderer] of Object.entries(renderers)) {
      expect(renderer.propsApiVersion, slot).toBe(
        slot === "detail" ? MARKDOWN_DETAIL_PROPS_API_VERSION : MARKDOWN_DISPLAY_PROPS_API_VERSION,
      );
    }
  });
});
