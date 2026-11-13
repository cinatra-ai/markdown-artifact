// THE POST'S TITLE IN THE MARKDOWN DISPLAY (cinatra-ai/cinatra#3978).
//
// The drawing (specs/app-lifecycle-cards.html section II.1) says of the post's
// review: "drawn by the markdown display - and what that display renders is
// the post itself: its title and its body text." The drawn Preview puts the
// post's title over its body.
//
// A post's body never carries its title: the draft writer returns the title
// apart from the body and must not repeat it as a heading. The host stores the
// title on the artifact row, so the title reaches this display as
// `artifact.title` and nowhere else. This suite pins that the display draws it
// over the body on the Preview tab of a post, and nowhere else.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import { postTitle, titleOverDocument } from "../src/renderers/markdown-post-title";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import type { ArtifactRendererProps } from "../src/artifact-renderer-props";
import { props, textContent } from "./props-fixture";
import { resetArtifactEditChannelStub } from "./stubs/artifact-edit-channel-stub";
import { resetMarkdownSanitizerStub } from "./stubs/markdown-sanitizer-stub";
import { resetToastStub } from "./stubs/sdk-ui-toast-stub";

const POST_TYPE = "@cinatra-ai/blog-post-artifact:post";
const TITLE = "Why migrations are the hardest part";
const BODY = "## The upgrade path\n\nTeams pick a stack in an afternoon.\n";

const DISPLAY = '[data-conformance-id="markdown-display-tabs"]';
const TITLE_NODE = "[data-post-title]";

const REVIEW_TARGET: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 2,
  reason: "read-only-surface",
};

function postProps(
  overrides: Partial<ArtifactRendererProps> = {},
  source: string = BODY,
  title: string | null = TITLE,
): ArtifactRendererProps {
  const base = props(textContent(source), {
    propsApiVersion: 5,
    edit: REVIEW_TARGET,
    review: { reading: "pending", openLive: null },
  });
  return {
    ...base,
    ...overrides,
    artifact: { ...base.artifact, objectType: POST_TYPE, title, ...overrides.artifact },
  };
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

describe("the post's title in the markdown display", () => {
  it("draws the post's title over its body on the Preview tab of the review", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps()} />);
    const panel = display(container).querySelector('[data-panel="preview"]');
    expect(panel, "the review opens on Preview").not.toBeNull();
    const title = (panel as Element).querySelector(TITLE_NODE);
    expect(title, "the title is drawn inside the Preview panel").not.toBeNull();
    expect(title?.textContent).toBe(TITLE);
    expect(title?.tagName).toBe("H2");
    const body = (panel as Element).querySelector("[data-markdown-body]");
    expect(body).not.toBeNull();
    expect((body as Node).contains(title as Node)).toBe(false);
    expect((title as Node).compareDocumentPosition(body as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(TITLE)).toHaveLength(1);
  });

  it("keeps the title when the review is continued, above the continued reading", () => {
    const review = { reading: "continued", openLive: null, decidedAt: "2026-10-07T09:35:30.000Z" } as const;
    const { container } = render(<MarkdownArtifactDetail {...postProps({ review })} />);
    const article = display(container);
    const title = article.querySelector(TITLE_NODE);
    const reading = article.querySelector('[data-conformance-id="post-continued-reading"]');
    expect(title?.textContent).toBe(TITLE);
    expect(reading).not.toBeNull();
    expect((title as Node).compareDocumentPosition(reading as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws no title on the Code tab: the Code tab shows the markdown as written", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(display(container).querySelector(TITLE_NODE)).toBeNull();
  });

  it("draws no title over a markdown document that is not a post", () => {
    const base = postProps();
    const other = { ...base, artifact: { ...base.artifact, objectType: "@cinatra-ai/markdown-artifact:artifact" } };
    const { container } = render(<MarkdownArtifactDetail {...other} />);
    expect(display(container).querySelector(TITLE_NODE)).toBeNull();
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it.each([null, "", "   "])("draws no title when the post has none (%j)", (title) => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({}, BODY, title)} />);
    expect(display(container).querySelector(TITLE_NODE)).toBeNull();
  });

  it("draws the title once when the body already opens with it as a heading", () => {
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({}, `# ${TITLE}\n\nTeams pick a stack in an afternoon.\n`)} />,
    );
    expect(display(container).querySelector(TITLE_NODE)).toBeNull();
  });

  it("draws nothing on a floor", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({}, "   ")} />);
    expect(container.querySelector(DISPLAY)).toBeNull();
    expect(container.querySelector(TITLE_NODE)).toBeNull();
  });

  it("leaves the preview slot reading v1 alone", () => {
    const { container } = render(<MarkdownArtifactPreview {...postProps()} />);
    expect(container.querySelector(TITLE_NODE)).toBeNull();
  });
});

describe("the title decision", () => {
  it("answers the trimmed title of a post and nothing for any other input", () => {
    expect(postTitle(postProps())).toBe(TITLE);
    expect(postTitle(postProps({}, BODY, `  ${TITLE}  `))).toBe(TITLE);
    expect(postTitle(postProps({}, BODY, null))).toBeNull();
    expect(postTitle(null)).toBeNull();
    expect(postTitle(undefined)).toBeNull();
    const base = postProps();
    expect(postTitle({ ...base, artifact: { ...base.artifact, objectType: "other:type" } })).toBeNull();
  });

  it("drops the title only where the document's first line is that same heading", () => {
    expect(titleOverDocument(TITLE, BODY)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# ${TITLE}\n\nText.`)).toBeNull();
    expect(titleOverDocument(TITLE, `\n\n## ${TITLE} ##\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `Text.\n\n# ${TITLE}\n`)).toBe(TITLE);
    expect(titleOverDocument(null, BODY)).toBeNull();
  });
});
