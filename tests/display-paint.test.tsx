// THE DISPLAY'S OWN PAINT — the colours, the underline and the block hierarchy
// the ratified drawing asks for, and the reason this package carries them itself.
//
// WHY THE DISPLAY SHIPS ITS OWN STYLESHEET. A host compiles its utility classes
// by SCANNING SOURCE, and an extension's source is not in the trees it scans: an
// installed package lives outside them, and a development clone lives in a path
// the host's own ignore rules exclude. Every utility class this display used
// that the host did not independently use somewhere in its own code was
// therefore never generated, and the rule simply did not exist at run time —
// silently, with the markup intact and the class attribute present.
//
// That is what happened to three of them. The active tab's underline drew at the
// right size in the right place with NO background, because the application's
// own tabs spell that class differently (behind a state variant) and the plain
// form was never generated. The code view's two arbitrary-value token colours
// were never generated at all, so a code span and a link span drew in the body
// colour and the view read as plain text in both themes.
//
// So the paint that MUST land lands through a stylesheet the package ships,
// keyed to the data attributes the display already writes, drawn entirely from
// the application's own custom properties. No colour is written here; every one
// is named. What survives as utility classes is layout the host uses everywhere
// and therefore always generates.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import { MARKDOWN_DISPLAY_CSS } from "../src/renderers/markdown-display-style";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import { props, textContent } from "./props-fixture";

const SOURCE =
  "# A heading\n\n" +
  "A paragraph with **bold**, _stress_, `code` and [a link](https://example.test).\n\n" +
  "- a list item\n\n" +
  "## A second heading\n\n" +
  "A second paragraph.\n";

const GRANT: ArtifactEditCapability = {
  kind: "editable",
  channelVersion: 1,
  artifactId: "art_1",
  baseRevisionId: "rev_1",
  saveUrl: "/api/artifacts/art_1/edit",
  idlePauseMs: 800,
  capBytes: 256 * 1024,
};

const REFUSED: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 1,
  reason: "read-only-surface",
};

const draw = (edit: ArtifactEditCapability) =>
  render(<MarkdownArtifactDetail {...props(textContent(SOURCE), { edit })} />);

/** Every declaration block whose selector matches `needle`. */
function rulesFor(needle: string): string[] {
  return MARKDOWN_DISPLAY_CSS.split("}")
    .map((block) => block.trim())
    .filter((block) => block.includes("{") && block.slice(0, block.indexOf("{")).includes(needle))
    .map((block) => block.slice(block.indexOf("{") + 1).trim());
}

afterEach(cleanup);

describe("the display ships the paint it needs — it never assumes the host generated it", () => {
  it("mounts its stylesheet with the display, on both the editable and the read-only surface", () => {
    for (const edit of [GRANT, REFUSED]) {
      cleanup();
      const { container } = draw(edit);
      const style = container.querySelector("style");
      expect(style).not.toBeNull();
      expect(style?.textContent ?? "").toContain("data-token");
    }
  });

  /**
   * A STYLE ELEMENT STYLES THE WHOLE DOCUMENT, not the subtree it sits in.
   *
   * So a rule this package ships is a rule about every page it is drawn on. The
   * rendered document's rules were keyed on the body attribute alone, which
   * would have restyled any host or third-party element anywhere on the page
   * that happened to carry the same attribute. Every selector must begin at the
   * display's own root.
   */
  it("scopes EVERY rule to the display's own root — it can reach nothing outside it", () => {
    const selectors = MARKDOWN_DISPLAY_CSS.split("}")
      .map((block) => block.trim())
      .filter((block) => block.includes("{"))
      .map((block) => block.slice(0, block.indexOf("{")).trim())
      .flatMap((selector) => selector.split(",").map((one) => one.trim()))
      .filter((one) => one.length > 0);

    expect(selectors.length).toBeGreaterThan(20);
    for (const selector of selectors) {
      expect(selector.startsWith('[data-artifact-renderer="markdown"]')).toBe(true);
    }
  });

  it("mounts ONE stylesheet per display, and pressing a tab does not add another", () => {
    const { container } = draw(GRANT);
    expect(container.querySelectorAll("style")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(container.querySelectorAll("style")).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(container.querySelectorAll("style")).toHaveLength(1);
  });

  it("writes NO colour of its own — every one is a named application token", () => {
    // A hex literal, an rgb()/hsl() call or a colour function here would be this
    // package deciding what the application looks like.
    expect(MARKDOWN_DISPLAY_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(MARKDOWN_DISPLAY_CSS).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/);
    expect(MARKDOWN_DISPLAY_CSS).toMatch(/var\(--/);
  });
});

describe("the CODE view reads in the application's own syntax colours (both themes)", () => {
  const colourOf = (kind: string) => {
    const rules = rulesFor(`[data-token="${kind}"]`);
    expect(rules.length, `no rule for the ${kind} token`).toBeGreaterThan(0);
    const colour = rules.join(";").match(/(?:^|;)\s*color:\s*([^;]+)/)?.[1]?.trim();
    expect(colour, `no colour for the ${kind} token`).toBeTruthy();
    return colour as string;
  };

  it("gives the coloured token kinds DIFFERENT colours, each from the palette", () => {
    const heading = colourOf("heading");
    const code = colourOf("code");
    const link = colourOf("link");
    const marker = colourOf("marker");

    // Distinct, so the syntax is READ rather than merely present.
    expect(new Set([heading, code, link, marker]).size).toBe(4);
    for (const colour of [heading, code, link, marker]) expect(colour).toMatch(/^var\(--/);
  });

  /**
   * THE DRAWING NAMES FOUR CONSTRUCTS, AND AN EMPHASIS MARKER IS ONE OF THEM:
   * "a heading, an emphasis marker, link syntax and a code span each read in
   * their own colour from this system's palette."
   *
   * The emphasis token carried a font-style and no colour at all, so an
   * emphasis marker read in the body colour — present, but not read in its own
   * colour, in either theme.
   */
  it("a heading, an emphasis marker, link syntax and a code span each read in their OWN colour", () => {
    const four = ["heading", "emphasis", "link", "code"].map(colourOf);
    expect(new Set(four).size, "two of the four share a colour").toBe(4);
    for (const colour of four) expect(colour).toMatch(/^var\(--/);

    // None of them may be the plain-text colour, or the construct would read as
    // prose rather than as syntax.
    const plain = rulesFor("[data-token]")
      .join(";")
      .match(/(?:^|;)\s*color:\s*([^;]+)/)?.[1]
      ?.trim();
    for (const colour of four) expect(colour).not.toBe(plain);
  });

  /**
   * IN BOTH THEMES, AND THAT IS A STATEMENT ABOUT WHICH TOKEN IS NAMED.
   *
   * `--primary` and `--accent` are re-aliased in the dark theme to a near-white
   * slate, so a syntax colour named from either reads as one indistinguishable
   * pale colour there however well it reads in the light theme. The status
   * tokens are declared separately in both themes, which is why the display
   * draws its syntax from those and from nothing else.
   */
  it("names only tokens the application declares in BOTH themes — never --primary or --accent", () => {
    for (const kind of ["heading", "emphasis", "link", "code", "marker"]) {
      const colour = colourOf(kind);
      expect(colour, `the ${kind} token`).not.toMatch(/var\(--primary\b/);
      expect(colour, `the ${kind} token`).not.toMatch(/var\(--accent\b/);
    }
  });

  /**
   * ALL FIVE AT ONCE, THE MARKER INCLUDED. Two suites each compared four of the
   * five, which leaves one pair — the emphasis marker against the syntax marker
   * — never compared with any other. Five colours, five readings.
   */
  it("gives all FIVE token kinds five different colours — no pair left uncompared", () => {
    const five = ["heading", "emphasis", "link", "code", "marker"].map(colourOf);
    expect(new Set(five).size, "two of the five share a colour").toBe(5);
  });

  it("draws an emphasis marker, link syntax and a code span as three separate tokens", () => {
    draw(GRANT);
    const kinds = [...document.querySelectorAll("[data-token]")].map((n) =>
      n.getAttribute("data-token"),
    );
    for (const kind of ["emphasis", "link", "code"]) {
      expect(kinds, `no ${kind} token in the drawn source`).toContain(kind);
    }
  });

  it("paints the plain text of the view with the foreground token", () => {
    expect(rulesFor("[data-token]").join(";")).toMatch(/color:\s*var\(--foreground/);
  });

  it("draws the tokens it colours — a heading, a code span and a link are all present", () => {
    draw(GRANT);
    const kinds = [...document.querySelectorAll("[data-token]")].map((n) =>
      n.getAttribute("data-token"),
    );
    for (const kind of ["heading", "code", "link", "strong", "marker"]) {
      expect(kinds, `no ${kind} token in the drawn source`).toContain(kind);
    }
  });
});

describe("the ACTIVE tab carries the 2px underline", () => {
  it("marks the active tab in the DOM, so the underline is a rule and not a class list", () => {
    draw(GRANT);
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs[0].getAttribute("data-active")).toBe("true");
    expect(tabs[1].getAttribute("data-active")).toBe("false");
  });

  it("underlines the active tab at 2px in the indigo token, and only the active one", () => {
    const underline = rulesFor('[data-active="true"]::after').join(";");
    expect(underline).toMatch(/height:\s*2px/);
    expect(underline).toMatch(/background:\s*var\(--info/);
    expect(underline).toMatch(/content:\s*""/);
    // The inactive tab has no underline rule to draw.
    expect(rulesFor('[data-active="false"]::after')).toEqual([]);
  });

  it("colours the active tab's own label with the same token as its underline", () => {
    expect(rulesFor('[role="tab"][data-active="true"]').join(";")).toMatch(/color:\s*var\(--info/);
  });

  /**
   * "THE ACTIVE ONE INDIGO UNDER A 2PX INDIGO UNDERLINE" — IN BOTH THEMES.
   *
   * `--primary` is the indigo hex in the light theme and is re-aliased to
   * `--accent` in the dark one, where `--accent` is a near-white slate. Naming
   * it drew the active tab and its underline correctly in light and as a pale
   * slate in dark — the same rule, two readings, one of them wrong. `--info` is
   * the indigo the application declares in its own right in BOTH themes.
   */
  it("names a token that is indigo in BOTH themes — never --primary or --accent", () => {
    const tab = rulesFor('[role="tab"][data-active="true"]').join(";");
    const underline = rulesFor('[data-active="true"]::after').join(";");
    for (const block of [tab, underline]) {
      expect(block).not.toMatch(/var\(--primary\b/);
      expect(block).not.toMatch(/var\(--accent\b/);
    }
  });

  it("moves the mark with the tab the person selects", () => {
    draw(GRANT);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("data-active")).toBe("false");
  });
});

describe("the PREVIEW renders with a real block hierarchy", () => {
  const size = (tag: string) => {
    const rules = rulesFor(`[data-markdown-body] ${tag}`).join(";");
    const fs = rules.match(/font-size:\s*([0-9.]+)rem/)?.[1];
    expect(fs, `no font-size for ${tag}`).toBeTruthy();
    return Number(fs);
  };

  it("gives headings their own size and weight, descending", () => {
    const h1 = size("h1");
    const h2 = size("h2");
    const h3 = size("h3");
    expect(h1).toBeGreaterThan(h2);
    expect(h2).toBeGreaterThan(h3);
    expect(h3).toBeGreaterThan(1);

    for (const tag of ["h1", "h2", "h3"]) {
      expect(rulesFor(`[data-markdown-body] ${tag}`).join(";")).toMatch(/font-weight:\s*[5-9]\d\d/);
    }
  });

  it("separates the blocks — paragraphs, lists and quotes all carry spacing", () => {
    for (const tag of ["p", "ul", "ol", "blockquote"]) {
      expect(
        rulesFor(`[data-markdown-body] ${tag}`).join(";"),
        `no spacing for ${tag}`,
      ).toMatch(/margin/);
    }
    // A list has to be readable AS a list.
    expect(rulesFor("[data-markdown-body] ul").join(";")).toMatch(
      /list-style|padding-inline-start|padding-left/,
    );
  });

  it("opens flush — the first block carries no leading space above it", () => {
    expect(rulesFor("[data-markdown-body] > :first-child").join(";")).toMatch(
      /margin-(block-start|top):\s*0/,
    );
  });

  it("draws the body the rules are keyed to", () => {
    const { container } = draw(REFUSED);
    expect(container.querySelector("[data-markdown-body]")).not.toBeNull();
  });
});

describe("the READ-ONLY surface — the review card's reading", () => {
  it("draws BOTH tabs, and opens on Preview with Code one press away", () => {
    draw(REFUSED);
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Code", "Preview"]);
    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("false");
    // The rendered document is what the reviewer opens on.
    expect(document.querySelector("[data-panel='preview']")).not.toBeNull();
    expect(document.querySelector("[data-panel='code']")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(document.querySelector("[data-panel='code']")).not.toBeNull();
  });

  it("still has no editing affordance in either tab", () => {
    draw(REFUSED);
    expect(screen.queryByLabelText("Markdown source")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.queryByLabelText("Markdown source")).toBeNull();
    expect(document.querySelector("[data-code-editor]")).toBeNull();
  });

  it("the EDITABLE surface still opens on Code — the editor is the point of that surface", () => {
    draw(GRANT);
    expect(screen.getByRole("tab", { name: "Code" }).getAttribute("aria-selected")).toBe("true");
  });
});

/**
 * WHICH TAB OPENS IS A QUESTION ABOUT THE SURFACE, NOT ABOUT RIGHTS.
 *
 * The drawing asks the review card to open on the rendered document and the
 * artifact's own page to open on the editor. Asking the edit GRANT answered a
 * different question, and got one case wrong: a reader who opens the artifact
 * page WITHOUT write rights is refused for `no-write-rights`, not because the
 * surface is read-only, and would have been handed the review card's reading of
 * a page they came to read as a page. The host names the surface itself.
 */
describe("the opening tab follows the SURFACE, not the edit grant", () => {
  const openingTab = (edit: ArtifactEditCapability) => {
    cleanup();
    draw(edit);
    return screen
      .getAllByRole("tab")
      .find((tab) => tab.getAttribute("aria-selected") === "true")
      ?.textContent;
  };

  it("opens the review card on Preview — the surface the host named read-only", () => {
    expect(openingTab({ kind: "read-only", channelVersion: 1, reason: "read-only-surface" })).toBe(
      "Preview",
    );
  });

  it("opens the artifact page on Code when the edit is granted", () => {
    expect(openingTab(GRANT)).toBe("Code");
  });

  it("KEEPS the artifact page's own opening view for a reader without write rights", () => {
    // Not the review card's reading: the page is still the page.
    for (const reason of ["no-write-rights", "content-truncated", "no-representation"] as const) {
      expect(openingTab({ kind: "read-only", channelVersion: 1, reason })).toBe("Code");
    }
  });

  it("draws BOTH tabs on every surface, whichever one opens", () => {
    for (const edit of [GRANT, REFUSED]) {
      cleanup();
      draw(edit);
      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Code", "Preview"]);
    }
  });
});

/**
 * THE LIGHT CODE VIEW DRAWS THE DOCUMENT.
 *
 * The editable Code view is two layers: the highlighted `<pre>` underneath, and
 * a transparent `<textarea>` over it carrying the caret. "Transparent" was a
 * utility class, and a utility class is compiled into a CASCADE LAYER — while
 * the application's own control ground ("inputs, selects and textareas take the
 * strong surface") is written as a PLAIN, UNLAYERED rule. An unlayered rule beats
 * every layered one whatever its specificity, so the textarea took the control
 * ground: an OPAQUE sheet over the highlighted text, with the textarea's own
 * letters transparent on top of it. The view measured as a blank panel with the
 * document present in the DOM and no ink on the pixels.
 *
 * The application's light theme is the one that carries that rule (its palette
 * is scoped to the light theme's own class, and the dark theme is a different
 * class), which is why the same view drew correctly in dark and blank in light.
 *
 * The display's own stylesheet is unlayered too, so it can answer the control
 * ground — but only if it out-specifies it, because both are unlayered and
 * source order between a host stylesheet and a mounted style element is not a
 * thing this package may rely on.
 */
describe("the CODE view's editor never covers the document it sits over", () => {
  const editorRule = () => rulesFor("textarea[data-code-editor]").join(";");

  it("gives the code editor a transparent ground of its own, in the display's own stylesheet", () => {
    expect(editorRule(), "no rule for the code editor's ground").toMatch(
      /background(-color)?:\s*transparent/,
    );
  });

  it("drops the control ground's inner highlight with it", () => {
    expect(editorRule()).toMatch(/box-shadow:\s*none/);
  });

  it("out-specifies the application's own control ground — both rules are unlayered", () => {
    // The host's rule is one class, one type and one attribute:
    //   .cinatra textarea:not([data-slot="input-group-control"])
    // so the display's must carry MORE than that to win on specificity alone.
    const selector = MARKDOWN_DISPLAY_CSS.split("}")
      .map((block) => block.trim())
      .filter((block) => block.includes("{"))
      .map((block) => block.slice(0, block.indexOf("{")).trim())
      .find((one) => one.includes("textarea[data-code-editor]"));
    expect(selector, "no code-editor selector at all").toBeTruthy();
    const attributes = (selector as string).match(/\[[^\]]+\]/g) ?? [];
    // [data-artifact-renderer="markdown"], [data-code-editor] and the
    // :not(...) exclusion the host's own rule carries: three, against the
    // host's one class plus one attribute.
    expect(attributes.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the caret visible while the letters under it are the ones that are read", () => {
    // The editor's own text is transparent BY DESIGN — the highlighted layer
    // beneath it is what a reader sees — but the caret is not.
    draw(GRANT);
    const editor = document.querySelector("textarea[data-code-editor]");
    expect(editor, "no code editor on the editable surface").not.toBeNull();
    expect(editor?.className).toMatch(/caret-foreground/);
  });

  /**
   * A SELECTION MUST NOT ERASE THE WORDS IT SELECTS.
   *
   * The editor's letters are transparent because the highlighted layer under
   * them is what is read — but a selection's background is painted by the editor
   * layer, ON TOP of that highlighted text. Selected words would have gone to a
   * blank band. The selected letters are given the foreground colour back, so a
   * selection reads as a selection: the highlight colours give way inside it and
   * the words stay there.
   */
  it("brings the editor's own letters back inside a SELECTION, so a selection does not blank the words", () => {
    const selection = rulesFor("textarea[data-code-editor]::selection").join(";");
    expect(selection, "no selection rule for the code editor").toBeTruthy();
    expect(selection).toMatch(/(^|;)\s*color:\s*var\(--foreground/);
    expect(selection).toMatch(/-webkit-text-fill-color:\s*var\(--foreground/);
    // Still no colour of this package's own invention.
    expect(selection).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|hsl\(|oklch\(/);
  });

  it("does not reach a textarea outside the display", () => {
    const selector = MARKDOWN_DISPLAY_CSS.split("}")
      .map((block) => block.trim())
      .filter((block) => block.includes("{"))
      .map((block) => block.slice(0, block.indexOf("{")).trim())
      .find((one) => one.includes("textarea[data-code-editor]")) as string;
    expect(selector.startsWith('[data-artifact-renderer="markdown"]')).toBe(true);
  });
});
