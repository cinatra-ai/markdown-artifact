// THE POST'S CONTINUED READING (cinatra-ai/cinatra#3978).
//
// The drawing puts each type's continuation sentence inside the type's own
// display, under the document, and the host draws only the generic settled
// marker beneath the whole display. A blog post is drawn by this display, so
// this display draws the post's sentence:
//
//   "The post keeps the revision it was continued at, and this review does not
//    re-open."
//
// It is drawn only when every fact it states is on the snapshot: a v5 snapshot
// of a blog post, a review in the continued reading, and the decision time of
// the reviewed revision. A display that is missing one of these facts draws no
// sentence.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import { markdownFloorMessage } from "../src/renderers/markdown-view";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import type { ArtifactRendererProps } from "../src/artifact-renderer-props";
import { props, textContent } from "./props-fixture";
import { resetArtifactEditChannelStub } from "./stubs/artifact-edit-channel-stub";
import { resetMarkdownSanitizerStub } from "./stubs/markdown-sanitizer-stub";
import { resetToastStub } from "./stubs/sdk-ui-toast-stub";

const SENTENCE = "The post keeps the revision it was continued at, and this review does not re-open.";
const POST_TYPE = "@cinatra-ai/blog-post-artifact:post";
const DECIDED_AT = "2026-10-07T09:35:30.000Z";
const SOURCE = "# Why migrations are the hardest part\n\nTeams pick a stack in an afternoon.\n";

const DISPLAY = '[data-conformance-id="markdown-display-tabs"]';
const READING = '[data-conformance-id="post-continued-reading"]';

const REVIEW_TARGET: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 2,
  reason: "read-only-surface",
};

const GRANT_V2: ArtifactEditCapability = {
  kind: "editable",
  channelVersion: 2,
  artifactId: "art_1",
  baseRevisionId: "rev_1",
  saveUrl: "/api/artifacts/art_1/edit",
  idlePauseMs: 900,
  capBytes: 256 * 1024,
  fields: ["text", "title"],
};

/** A v5 snapshot of a blog post on a review target, shaped as the host builds one. */
function postProps(overrides: Partial<ArtifactRendererProps> = {}): ArtifactRendererProps {
  const base = props(textContent(SOURCE), {
    propsApiVersion: 5,
    edit: REVIEW_TARGET,
    review: { reading: "continued", openLive: null, decidedAt: DECIDED_AT },
  });
  return { ...base, ...overrides, artifact: { ...base.artifact, objectType: POST_TYPE, ...overrides.artifact } };
}

function display(container: HTMLElement): Element {
  const node = container.querySelector(DISPLAY);
  expect(node, "the tabbed display is drawn").not.toBeNull();
  return node as Element;
}

afterEach(cleanup);

beforeEach(() => {
  resetMarkdownSanitizerStub();
  resetArtifactEditChannelStub();
  resetToastStub();
});

describe("the post's continued reading in the markdown display", () => {
  it("draws the post's sentence inside the display, under the document, once the review is continued", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps()} />);
    const article = display(container);
    const reading = article.querySelector(READING);
    expect(reading, "the continued reading is drawn inside the display").not.toBeNull();
    expect(reading?.textContent).toBe(SENTENCE);
    expect(reading?.getAttribute("data-field")).toBe("reading=review.reading");
    expect(reading?.getAttribute("data-state")).toBe("empty");
    expect(reading?.querySelector('[data-field="decision=review.decidedAt"]')?.textContent).toBe(SENTENCE);
    const panel = article.querySelector('[role="tabpanel"]') as Node;
    expect(panel.compareDocumentPosition(reading as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reading?.querySelector("button, a")).toBeNull();
    // The generic settled marker is the host's, never the display's.
    expect(screen.queryByText(/Decided on the revision above/)).toBeNull();
    expect(screen.getAllByText(SENTENCE)).toHaveLength(1);
  });

  it("keeps the sentence under the document on the Code tab too", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    const article = display(container);
    const panel = article.querySelector('[data-panel="code"]');
    expect(panel).not.toBeNull();
    const reading = article.querySelector(READING);
    expect(reading?.textContent).toBe(SENTENCE);
    expect((panel as Node).contains(reading as Node)).toBe(false);
    expect((panel as Node).compareDocumentPosition(reading as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no sentence while the review is still pending", () => {
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({ review: { reading: "pending", openLive: null } })} />,
    );
    expect(display(container).querySelector(READING)).toBeNull();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  it("draws no sentence when the snapshot carries no review reading", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({ review: undefined })} />);
    expect(display(container).querySelector(READING)).toBeNull();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  it.each([undefined, "", "not-a-date", "2026-10-07", "2026-10-07T09:35:30Z", "2026-02-30T05:00:00.000Z"])(
    "draws no sentence when the decision time is missing or not the host's instant (%s)",
    (decidedAt) => {
      const review = { reading: "continued", openLive: null, decidedAt } as ArtifactRendererProps["review"];
      const { container } = render(<MarkdownArtifactDetail {...postProps({ review })} />);
      expect(display(container).querySelector(READING)).toBeNull();
      expect(screen.queryByText(SENTENCE)).toBeNull();
    },
  );

  it("draws no sentence over a markdown document that is not a post", () => {
    const base = postProps();
    const other = { ...base, artifact: { ...base.artifact, objectType: "@cinatra-ai/markdown-artifact:artifact" } };
    const { container } = render(<MarkdownArtifactDetail {...other} />);
    expect(display(container).querySelector(READING)).toBeNull();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  it("draws no sentence on the unchanged v1 reading, which carries no review", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({ propsApiVersion: 1 })} />);
    expect(display(container).querySelector(READING)).toBeNull();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });

  it("opens the editor on a version-2 grant at v5, and draws no sentence where the edit is granted", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({ edit: GRANT_V2 })} />);
    const article = display(container);
    expect(article.getAttribute("data-editable")).toBe("true");
    expect(screen.getByLabelText("Markdown source")).toBeTruthy();
    expect(article.querySelector(READING)).toBeNull();
  });

  it("leaves the preview slot reading v1 alone", () => {
    render(<MarkdownArtifactPreview {...postProps()} />);
    expect(screen.getByText(markdownFloorMessage("props-version"))).toBeTruthy();
    expect(screen.queryByText(SENTENCE)).toBeNull();
  });
});
