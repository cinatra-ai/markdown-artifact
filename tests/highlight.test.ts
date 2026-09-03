// THE CODE VIEW'S HIGHLIGHTER — and the one invariant the editable view rests on.
//
// The editable Code view is a transparent textarea over a highlighted `<pre>`.
// If the highlighted text differed from the text by one character, the caret and
// the letters under it would drift apart, and every edit past that point would
// land in the wrong place. So the property proved first, and over every shape
// this package expects, is that THE SPANS CONCATENATE BACK TO THE INPUT.

import { describe, expect, it } from "vitest";

import { highlightMarkdown, tokensJoin } from "../src/renderers/markdown-code-highlight";

const SAMPLES = [
  "",
  "\n",
  "plain prose with no markdown at all",
  "# A heading\n\nA paragraph with **bold**, _emphasis_, `code` and [a link](/docs).\n",
  "- one\n- two\n  - nested\n1. first\n2. second\n",
  "> a quotation\n> over two lines\n",
  "```ts\nconst x = 1; // # not a heading\n```\ntext after the fence\n",
  "trailing spaces   \n\n\n",
  "a * b * c and 2 * 3 and **unclosed\n",
  "emoji 🎉 and accents éàü and a tab\there\n",
];

describe("the highlighter never changes the text it highlights", () => {
  for (const sample of SAMPLES) {
    it(`round-trips ${JSON.stringify(sample.slice(0, 32))}`, () => {
      expect(tokensJoin(highlightMarkdown(sample))).toBe(sample);
    });
  }
});

describe("what it colours", () => {
  const kinds = (source: string) =>
    highlightMarkdown(source)
      .filter((t) => t.kind !== "text")
      .map((t) => [t.kind, t.text]);

  it("colours a heading line whole", () => {
    expect(kinds("## Why migrations are hard\n")).toContainEqual(["heading", "## Why migrations are hard"]);
  });

  it("colours bold, emphasis, code spans and links", () => {
    const got = kinds("a **b** c _d_ e `f` g [h](/i)\n");
    expect(got).toContainEqual(["strong", "**b**"]);
    expect(got).toContainEqual(["emphasis", "_d_"]);
    expect(got).toContainEqual(["code", "`f`"]);
    expect(got).toContainEqual(["link", "[h](/i)"]);
  });

  it("colours list and quotation markers, and leaves their content alone", () => {
    expect(kinds("- an **item**\n")).toContainEqual(["marker", "- "]);
    expect(kinds("> a quote\n")).toContainEqual(["marker", "> "]);
  });

  it("treats everything inside a fence as code — a # there is not a heading", () => {
    const got = highlightMarkdown("```sh\n# not a heading\n```\n");
    expect(got.filter((t) => t.kind === "heading")).toHaveLength(0);
    expect(got.filter((t) => t.kind === "code").length).toBeGreaterThan(0);
  });

  it("never reads markdown inside a code span", () => {
    expect(kinds("`**not bold**`\n")).toContainEqual(["code", "`**not bold**`"]);
    expect(kinds("`**not bold**`\n")).not.toContainEqual(["strong", "**not bold**"]);
  });
});
