import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import { MARKDOWN_DISPLAY_UNAVAILABLE } from "../src/display-unavailable";
import type { ArtifactRendererProps } from "../src/artifact-renderer-props";

afterEach(cleanup);

const MARKDOWN_BODY = "# A heading\n\n<img src=x onerror=alert(1)>\n\n[a link](https://example.test)";

function props(): ArtifactRendererProps {
  return {
    propsApiVersion: 1,
    artifact: {
      id: "art_1",
      title: MARKDOWN_BODY,
      objectType: "@cinatra-ai/markdown-artifact:artifact",
      mime: "text/markdown",
      size: 2048,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ownerLevel: "workspace",
      visibility: "organization",
      sourceUrl: null,
    },
    representation: { revisionId: "rev_1", mime: "text/markdown" },
    urls: { preview: "/api/artifacts/art_1/preview", download: "/api/artifacts/art_1/download" },
    identity: { kind: "extension", extension: "@cinatra-ai/markdown-artifact" },
    actions: { download: "/api/artifacts/art_1/download", openInSource: null },
  };
}

const entries: Array<[string, (p: ArtifactRendererProps) => unknown]> = [
  ["detail", MarkdownArtifactDetail],
  ["preview", MarkdownArtifactPreview],
];

describe("the markdown displays are declared but not yet drawable", () => {
  for (const [slot, entry] of entries) {
    it(`${slot} refuses to render, with a reason a reader can act on`, () => {
      expect(() => entry(props())).toThrowError(MARKDOWN_DISPLAY_UNAVAILABLE);
    });

    it(`${slot} refuses the same way for an empty snapshot`, () => {
      expect(() => entry({} as unknown as ArtifactRendererProps)).toThrowError(
        MARKDOWN_DISPLAY_UNAVAILABLE,
      );
    });

    it(`${slot} puts NOTHING in the DOM when it is actually mounted`, () => {
      const Entry = entry as (p: ArtifactRendererProps) => ReactElement;
      const host = document.createElement("div");
      document.body.appendChild(host);
      expect(() => render(<Entry {...props()} />, { container: host })).toThrowError(
        MARKDOWN_DISPLAY_UNAVAILABLE,
      );
      expect(host.innerHTML).toBe("");
      expect(host.textContent).toBe("");
      host.remove();
    });

    it(`${slot} never lets the document's own markdown reach the DOM`, () => {
      try {
        render(<>{(entry as (p: ArtifactRendererProps) => ReactElement)(props())}</>);
      } catch {
        // The refusal is the contract; what matters is what did NOT get drawn.
      }
      expect(document.body.innerHTML).not.toContain("A heading");
      expect(document.body.innerHTML).not.toContain("onerror");
      expect(document.body.querySelector("img")).toBeNull();
    });
  }

  it("the two entries are distinct modules, so a swap in the manifest is visible", () => {
    expect(MarkdownArtifactDetail).not.toBe(MarkdownArtifactPreview);
    expect(MarkdownArtifactDetail.name).toBe("MarkdownArtifactDetail");
    expect(MarkdownArtifactPreview.name).toBe("MarkdownArtifactPreview");
  });

  it("says what is missing, not just that something is", () => {
    expect(MARKDOWN_DISPLAY_UNAVAILABLE).toContain("markdown");
    expect(MARKDOWN_DISPLAY_UNAVAILABLE).toContain("sanitizer");
    expect(MARKDOWN_DISPLAY_UNAVAILABLE.length).toBeGreaterThan(40);
  });
});
