// THE DISPLAY CONTRACT — the half this package owns, pinned against the inert
// recording double: the pinned text goes to the one shared sanitizer, its
// output is injected verbatim, the document's own markdown reaches the DOM by
// no other road, and every content the display cannot draw becomes a NAMED
// floor rather than a blank slot or a throw.
//
// What the sanitizer admits and strips is pinned against the REAL leaf in
// `tests/sanitizer-conformance.test.tsx`.

import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import {
  MARKDOWN_DISPLAY_PROPS_API_VERSION,
  markdownFloorMessage,
  resolveMarkdownView,
} from "../src/renderers/markdown-view";
import type { ArtifactRendererProps } from "../src/artifact-renderer-props";
import { props, textContent } from "./props-fixture";
import { REAL_SANITIZER } from "./sanitizer-mode";
import {
  resetMarkdownSanitizerStub,
  sanitizerCalls,
  sanitizerStubState,
} from "./stubs/markdown-sanitizer-stub";

const MARKDOWN_BODY = "# A heading\n\n<img src=x onerror=alert(1)>\n\n[a link](https://example.test)";

type Entry = (p: ArtifactRendererProps) => ReactElement;
const entries: Array<[string, Entry]> = [
  ["detail", MarkdownArtifactDetail as Entry],
  ["preview", MarkdownArtifactPreview as Entry],
];

afterEach(cleanup);

describe.skipIf(REAL_SANITIZER)("the markdown displays draw through the shared sanitizer", () => {
  beforeEach(() => {
    resetMarkdownSanitizerStub();
  });

  for (const [slot, Entry] of entries) {
    it(`${slot} hands the PINNED text to the sanitizer exactly once`, () => {
      render(<Entry {...props(textContent(MARKDOWN_BODY))} />);
      expect(sanitizerCalls).toHaveLength(1);
      expect(sanitizerCalls[0].markdown).toBe(MARKDOWN_BODY);
    });

    it(`${slot} injects the sanitizer's OUTPUT, not the document's markdown`, () => {
      sanitizerStubState.html = '<p data-marker="from-the-sanitizer">only this</p>';
      const { container } = render(<Entry {...props(textContent(MARKDOWN_BODY))} />);
      expect(container.querySelector('[data-marker="from-the-sanitizer"]')).not.toBeNull();
      expect(container.textContent).toContain("only this");
      expect(container.innerHTML).not.toContain("onerror");
      expect(container.innerHTML).not.toContain("# A heading");
    });

    it(`${slot} never fetches and never reads the byte urls`, () => {
      const { container } = render(<Entry {...props(textContent(MARKDOWN_BODY))} />);
      expect(container.querySelector("iframe")).toBeNull();
      expect(container.innerHTML).not.toContain("/preview");
      expect(container.innerHTML).not.toContain("/download");
    });

    it(`${slot} draws the content the channel pinned, at the revision it names`, () => {
      const { container } = render(
        <Entry
          {...props(textContent(MARKDOWN_BODY, { representationRevisionId: "rev_7" }))}
        />,
      );
      const root = container.querySelector("[data-artifact-renderer='markdown']");
      expect(root).not.toBeNull();
      expect(root?.getAttribute("data-slot")).toBe(slot);
      expect(root?.getAttribute("data-revision")).toBe("rev_7");
    });

    it(`${slot} says so, in place, when the pinned content was cut to its cap`, () => {
      const { container } = render(
        <Entry
          {...props(
            textContent(MARKDOWN_BODY, {
              truncated: true,
              byteLength: 900000,
              projectedByteLength: 262144,
            }),
          )}
        />,
      );
      expect(container.querySelector("[data-truncated='true']")).not.toBeNull();
      expect(container.textContent).toContain("262,144");
      expect(container.textContent).toContain("900,000");
    });

    it(`${slot} floors, NAMED and never blank, for every content it cannot draw`, () => {
      const cases: Array<[ArtifactRendererProps, string]> = [
        [
          props({ kind: "none", channelVersion: 1, representationRevisionId: null, reason: "absent" }),
          "content-absent",
        ],
        [
          props({
            kind: "none",
            channelVersion: 1,
            representationRevisionId: "rev_1",
            reason: "over-cap",
          }),
          "content-over-cap",
        ],
        [
          props({
            kind: "none",
            channelVersion: 1,
            representationRevisionId: "rev_1",
            reason: "unsupported-form",
          }),
          "content-unsupported-form",
        ],
        [
          props({
            kind: "configuration",
            channelVersion: 1,
            representationRevisionId: "rev_1",
            configuration: {},
            digest: "d",
            byteLength: 2,
            projectedByteLength: 2,
            cap: 131072,
          }),
          "content-not-text",
        ],
        [props(textContent("   \n  ")), "empty-document"],
        [props(textContent(MARKDOWN_BODY), { propsApiVersion: 2 }), "props-version"],
        [
          props(textContent(MARKDOWN_BODY, { channelVersion: 2 })),
          "channel-version",
        ],
      ];
      for (const [p, reason] of cases) {
        const { container, unmount } = render(<Entry {...p} />);
        const floor = container.querySelector(`[data-floor='${reason}']`);
        expect(floor, `slot ${slot} floor for ${reason}`).not.toBeNull();
        expect((floor?.textContent ?? "").length).toBeGreaterThan(20);
        expect(container.innerHTML).not.toContain("onerror");
        unmount();
      }
    });

    it(`${slot} floors instead of throwing on a malformed snapshot`, () => {
      for (const malformed of [{}, null, undefined]) {
        const { container, unmount } = render(
          <Entry {...(malformed as unknown as ArtifactRendererProps)} />,
        );
        expect(container.querySelector("[data-floor]")).not.toBeNull();
        expect(container.textContent?.trim().length).toBeGreaterThan(0);
        unmount();
      }
    });
  }

  it("the preview draws the SAME sanitized rendering as the detail, in a clipped container", () => {
    const p = props(textContent(MARKDOWN_BODY));
    const detail = render(<MarkdownArtifactDetail {...p} />).container;
    const detailBody = detail.querySelector("[data-markdown-body]")?.innerHTML;
    cleanup();
    resetMarkdownSanitizerStub();
    const preview = render(<MarkdownArtifactPreview {...p} />).container;
    const previewBody = preview.querySelector("[data-markdown-body]")?.innerHTML;
    expect(previewBody).toBe(detailBody);
    expect(preview.querySelector("[data-compact='true']")).not.toBeNull();
    expect(detail.querySelector("[data-compact='true']")).toBeNull();
  });

  it("the two entries stay distinct modules, so a swap in the manifest is visible", () => {
    expect(MarkdownArtifactDetail).not.toBe(MarkdownArtifactPreview);
    expect(MarkdownArtifactDetail.name).toBe("MarkdownArtifactDetail");
    expect(MarkdownArtifactPreview.name).toBe("MarkdownArtifactPreview");
  });
});

describe("the view decision, as a pure leaf", () => {
  it("declares the props version the manifest entries declare", () => {
    expect(MARKDOWN_DISPLAY_PROPS_API_VERSION).toBe(1);
  });

  it("names a floor sentence for every floor reason, none of them blank", () => {
    const reasons = [
      "malformed-props",
      "props-version",
      "channel-version",
      "content-absent",
      "content-over-cap",
      "content-unsupported-form",
      "content-not-text",
      "empty-document",
    ] as const;
    const sentences = new Set<string>();
    for (const reason of reasons) {
      const sentence = markdownFloorMessage(reason);
      expect(sentence.length).toBeGreaterThan(20);
      sentences.add(sentence);
    }
    expect(sentences.size).toBe(reasons.length);
  });

  it("never throws, whatever it is handed", () => {
    for (const input of [null, undefined, 1, "x", [], {}, { content: null }]) {
      expect(() => resolveMarkdownView(input as never)).not.toThrow();
      expect(resolveMarkdownView(input as never).kind).toBe("floor");
    }
  });
});
