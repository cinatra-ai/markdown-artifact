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
import { props, readOnlyEdit, textContent } from "./props-fixture";
import { resetArtifactEditChannelStub } from "./stubs/artifact-edit-channel-stub";
import { resetMarkdownSanitizerStub, sanitizerStubState } from "./stubs/markdown-sanitizer-stub";
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

  // The sanitizer double renders no markdown, so each case below hands it the
  // HTML the real sanitizer draws for the body's opening heading (this display
  // demotes headings, so a `#` heading is drawn as an h2). The visible copies
  // of the title are then counted in the whole display.
  it("draws one visible title when the body already opens with it as an ATX heading", () => {
    sanitizerStubState.html = `<h2>${TITLE}</h2><p>Teams pick a stack in an afternoon.</p>`;
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({}, `# ${TITLE}\n\nTeams pick a stack in an afternoon.\n`)} />,
    );
    const article = display(container);
    expect(article.querySelector(TITLE_NODE)).toBeNull();
    const copies = screen.getAllByText(TITLE);
    expect(copies).toHaveLength(1);
    expect(article.querySelector("[data-markdown-body]")?.contains(copies[0])).toBe(true);
  });

  it("draws one visible title when the opening heading wraps the title in emphasis", () => {
    sanitizerStubState.html = `<h2><strong>${TITLE}</strong></h2><p>Teams pick a stack in an afternoon.</p>`;
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({}, `# **${TITLE}**\n\nTeams pick a stack in an afternoon.\n`)} />,
    );
    const article = display(container);
    expect(article.querySelector(TITLE_NODE)).toBeNull();
    const copies = screen.getAllByText(TITLE);
    expect(copies).toHaveLength(1);
    expect(article.querySelector("[data-markdown-body]")?.contains(copies[0])).toBe(true);
  });

  it("draws a title holding markdown characters as plain text, whatever the body opens with", () => {
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({}, "# **bold**\n\nText.\n", "**bold**")} />,
    );
    expect(display(container).querySelector(TITLE_NODE)?.textContent).toBe("**bold**");
  });

  it("draws the title over a body that opens with an empty heading whose closing sequence is all of it", () => {
    sanitizerStubState.html = "<h2></h2><p>Text.</p>";
    const { container } = render(<MarkdownArtifactDetail {...postProps({}, "# #\n\nText.\n", "#")} />);
    expect(display(container).querySelector(TITLE_NODE)?.textContent).toBe("#");
  });

  it("draws the title over a body whose first line is indented code, not a heading", () => {
    const { container } = render(
      <MarkdownArtifactDetail {...postProps({}, `    # ${TITLE}\n\nText.\n`)} />,
    );
    expect(display(container).querySelector(TITLE_NODE)?.textContent).toBe(TITLE);
  });

  it("draws nothing on a floor", () => {
    const { container } = render(<MarkdownArtifactDetail {...postProps({}, "   ")} />);
    expect(container.querySelector(DISPLAY)).toBeNull();
    expect(container.querySelector(TITLE_NODE)).toBeNull();
  });

  it("draws no title on a valid v1 preview of a post", () => {
    // A VALID v1 snapshot (props version 1, a version-1 refusal, no review), so
    // the preview draws the document itself, not a props-version floor.
    const base = props(textContent(BODY), { edit: readOnlyEdit() });
    const v1 = { ...base, artifact: { ...base.artifact, objectType: POST_TYPE, title: TITLE } };
    const { container } = render(<MarkdownArtifactPreview {...v1} />);
    expect(container.querySelector("[data-markdown-body]"), "the v1 preview draws the document").not.toBeNull();
    expect(container.querySelector(TITLE_NODE)).toBeNull();
    expect(screen.queryByText(TITLE)).toBeNull();
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

  it.each([3, 4, 5, 6])("drops the title under an opening level-%i heading", (level) => {
    expect(titleOverDocument(TITLE, `${"#".repeat(level)} ${TITLE}\n\nText.`)).toBeNull();
  });

  it("keeps the title under a level-7 run, which is no heading", () => {
    expect(titleOverDocument(TITLE, `####### ${TITLE}\n`)).toBe(TITLE);
  });

  it("reads at most three leading spaces and no tab before the heading (CommonMark)", () => {
    expect(titleOverDocument(TITLE, `   # ${TITLE}\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `    # ${TITLE}\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `\t# ${TITLE}\n`)).toBe(TITLE);
  });

  it("drops the title under an opening heading that wraps it whole in emphasis or code", () => {
    expect(titleOverDocument(TITLE, `# **${TITLE}**\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# *${TITLE}*\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# _${TITLE}_\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# __${TITLE}__\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# ***${TITLE}***\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# **_${TITLE}_**\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# \`${TITLE}\`\n`)).toBeNull();
  });

  it("keeps the title where the heading's markup is not a whole wrapper of it", () => {
    expect(titleOverDocument(TITLE, `# \`**${TITLE}**\`\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# **${TITLE}*\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# ** ${TITLE}**\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# [${TITLE}](https://example.com)\n`)).toBe(TITLE);
  });

  it("keeps a title that holds markdown characters, so it stays plain text", () => {
    expect(titleOverDocument("**bold**", "# **bold**\n")).toBe("**bold**");
    expect(titleOverDocument("a_b", "# a_b\n")).toBe("a_b");
    expect(titleOverDocument("<b>x</b>", "# <b>x</b>\n")).toBe("<b>x</b>");
  });

  it("keeps the title under a setext opening heading and a case-different heading", () => {
    expect(titleOverDocument(TITLE, `${TITLE}\n===\n\nText.`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# ${TITLE.toLowerCase()}\n`)).toBe(TITLE);
  });

  it("keeps the title under an empty opening heading, a closing sequence being all of it (CommonMark)", () => {
    expect(titleOverDocument("#", "# #\n\nText.")).toBe("#");
    expect(titleOverDocument("###", "### ###\n")).toBe("###");
    expect(titleOverDocument("#", "## ##\n")).toBe("#");
    expect(titleOverDocument(TITLE, "#\n\nText.")).toBe(TITLE);
    expect(titleOverDocument(TITLE, "#   \n\nText.")).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# #\n\n# ${TITLE}\n`)).toBe(TITLE);
  });

  it("strips a closing sequence only where a space or tab precedes it", () => {
    expect(titleOverDocument("C# tips", "# C# tips #\n")).toBeNull();
    expect(titleOverDocument("C#", "# C#\n")).toBeNull();
    expect(titleOverDocument(TITLE, `# ${TITLE}\t#\t\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# ${TITLE}#\n`)).toBe(TITLE);
  });

  it("reads CR, LF and CRLF as line endings (CommonMark)", () => {
    expect(titleOverDocument(TITLE, `# ${TITLE}\r\rText.`)).toBeNull();
    expect(titleOverDocument(TITLE, `\r\r# ${TITLE}\r`)).toBeNull();
    expect(titleOverDocument(TITLE, `\r\n# ${TITLE}\r\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `Text.\r# ${TITLE}\r`)).toBe(TITLE);
  });

  it("needs a space or tab after the opening run, and takes one to three leading spaces", () => {
    expect(titleOverDocument(TITLE, `#${TITLE}\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `#\t${TITLE}\n`)).toBeNull();
    expect(titleOverDocument(TITLE, ` # ${TITLE}\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `  # ${TITLE}\n`)).toBeNull();
  });

  it("reads a code span only between equal backtick fences", () => {
    expect(titleOverDocument(TITLE, `# \`\`${TITLE}\`\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# \`${TITLE}\`\`\n`)).toBe(TITLE);
    expect(titleOverDocument(TITLE, `# \`\`${TITLE}\`\`\n`)).toBeNull();
    expect(titleOverDocument(TITLE, `# \`\` ${TITLE} \`\`\n`)).toBeNull();
  });

  it("decides in linear time on long crafted headings", () => {
    const crafted = [
      "# a" + " ".repeat(100000) + "#".repeat(100000) + "x",
      "# " + "*".repeat(60000) + "T" + "*".repeat(59999),
      "# " + "`".repeat(60000) + "T" + "`".repeat(59999),
      "#".repeat(200000) + " T",
    ];
    for (const source of crafted) {
      const start = performance.now();
      expect(titleOverDocument("T", source)).toBe("T");
      expect(performance.now() - start).toBeLessThan(200);
    }
  });
});
