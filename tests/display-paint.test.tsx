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

  it("underlines the active tab at 2px in the primary token, and only the active one", () => {
    const underline = rulesFor('[data-active="true"]::after').join(";");
    expect(underline).toMatch(/height:\s*2px/);
    expect(underline).toMatch(/background:\s*var\(--primary/);
    expect(underline).toMatch(/content:\s*""/);
    // The inactive tab has no underline rule to draw.
    expect(rulesFor('[data-active="false"]::after')).toEqual([]);
  });

  it("colours the active tab's own label with the same token as its underline", () => {
    expect(rulesFor('[role="tab"][data-active="true"]').join(";")).toMatch(
      /color:\s*var\(--primary/,
    );
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
