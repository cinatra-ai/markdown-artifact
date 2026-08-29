// WHAT THE DISPLAY ACTUALLY DRAWS, end to end, through the REAL shared
// sanitizer: every markdown construct the sanitizer admits, and nothing it does
// not. One row per construct, mounted through the display entry itself — not
// through the sanitizer alone — so what is pinned is what a reader would see.
//
// This suite needs the SDK tree that publishes the sanitizer leaf entry
// (`CINATRA_SDK_EXTENSIONS_DIR`), because the sanitizer is host-provided and
// there is exactly ONE implementation of it in the fleet. Without that tree the
// suite skips: this package must never carry a second sanitizer, not even to
// make its own test run look fuller.

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import { props, textContent } from "./props-fixture";
import { REAL_SANITIZER } from "./sanitizer-mode";

afterEach(cleanup);

function drawn(markdown: string): HTMLElement {
  const { container } = render(<MarkdownArtifactDetail {...props(textContent(markdown))} />);
  const body = container.querySelector("[data-markdown-body]");
  if (!body) throw new Error("the display drew no document body");
  return body as HTMLElement;
}

describe.skipIf(!REAL_SANITIZER)("what the shared sanitizer ADMITS, drawn by the display", () => {
  it("headings, demoted one level so the page shell keeps the only top heading", () => {
    const body = drawn("# One\n\n## Two\n\n###### Six");
    expect(body.querySelector("h1")).toBeNull();
    expect(body.querySelector("h2")?.textContent).toBe("One");
    expect(body.querySelector("h3")?.textContent).toBe("Two");
    expect(body.querySelector("h6")?.textContent).toBe("Six");
  });

  it("emphasis, strong emphasis and strikethrough", () => {
    const body = drawn("*em* **strong** ~~gone~~");
    expect(body.querySelector("em")?.textContent).toBe("em");
    expect(body.querySelector("strong")?.textContent).toBe("strong");
    expect(body.querySelector("del")?.textContent).toBe("gone");
  });

  it("unordered, ordered and task lists", () => {
    const body = drawn("- a\n- b\n\n1. one\n2. two\n\n- [x] done\n- [ ] open");
    expect(body.querySelectorAll("ul").length).toBeGreaterThanOrEqual(1);
    expect(body.querySelector("ol")?.querySelectorAll("li")).toHaveLength(2);
    expect(body.querySelectorAll("li").length).toBeGreaterThanOrEqual(6);
  });

  it("block quotes, horizontal rules and tables", () => {
    const body = drawn("> quoted\n\n---\n\n| a | b |\n| - | - |\n| 1 | 2 |");
    expect(body.querySelector("blockquote")?.textContent).toContain("quoted");
    expect(body.querySelector("hr")).not.toBeNull();
    expect(body.querySelector("table")?.querySelectorAll("td")).toHaveLength(2);
  });

  it("code spans and fenced code, with the code kept as TEXT", () => {
    const body = drawn("a `span` here\n\n```js\nconst x = \"<b>not markup</b>\";\n```");
    expect(body.querySelector("code")).not.toBeNull();
    const pre = body.querySelector("pre");
    expect(pre?.textContent).toContain("const x =");
    expect(pre?.textContent).toContain("<b>not markup</b>");
    expect(pre?.querySelector("b")).toBeNull();
  });

  it("links on the allow-listed schemes, external ones opened safely", () => {
    const body = drawn(
      "[web](https://example.test/a) [plain](http://example.test/b) [mail](mailto:a@example.test) [deep](cinatra:install/x)",
    );
    const hrefs = [...body.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "https://example.test/a",
      "http://example.test/b",
      "mailto:a@example.test",
      "cinatra:install/x",
    ]);
    const web = body.querySelector('a[href="https://example.test/a"]');
    expect(web?.getAttribute("rel")).toContain("noopener");
    expect(web?.getAttribute("target")).toBe("_blank");
    expect(body.querySelector('a[href="mailto:a@example.test"]')?.getAttribute("target")).toBeNull();
  });

  it("images on the web schemes, drawn passively", () => {
    const body = drawn("![alt text](https://example.test/p.png)");
    const img = body.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.test/p.png");
    expect(img?.getAttribute("alt")).toBe("alt text");
    expect(img?.getAttribute("loading")).toBe("lazy");
    expect(img?.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
});

describe.skipIf(!REAL_SANITIZER)("what the shared sanitizer REFUSES, never drawn", () => {
  it("raw markup in the document is not markup in the page", () => {
    const body = drawn('text\n\n<div id="raw"><b>bold</b></div>\n\nmore');
    expect(body.querySelector("#raw")).toBeNull();
    expect(body.querySelector("div")).toBeNull();
    expect(body.innerHTML).not.toContain("<b>");
  });

  it("a script tag reaches the page neither as markup nor as an element", () => {
    const body = drawn('<script>window.__pwned = 1;</script>\n\nafter');
    expect(body.querySelector("script")).toBeNull();
    expect(body.innerHTML.toLowerCase()).not.toContain("<script");
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("an event handler smuggled through an image tag never lands", () => {
    const body = drawn("before\n\n<img src=x onerror=alert(1)>\n\nafter");
    expect(body.querySelector("img")).toBeNull();
    expect(body.innerHTML).not.toContain("onerror");
    expect(body.textContent).toContain("before");
    expect(body.textContent).toContain("after");
  });

  it("a document that is nothing BUT raw markup draws nothing, and says so", () => {
    const { container } = render(
      <MarkdownArtifactDetail {...props(textContent("<img src=x onerror=alert(1)>"))} />,
    );
    expect(container.querySelector("[data-floor=empty-document]")).not.toBeNull();
    expect(container.querySelector("[data-markdown-body]")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });

  it("a script-scheme link keeps its text and loses its destination", () => {
    const body = drawn("[click me](javascript:alert(1))");
    expect(body.querySelector("a")).toBeNull();
    expect(body.textContent).toContain("click me");
    expect(body.innerHTML).not.toContain("javascript:");
  });

  it("data, file and protocol-relative destinations are refused the same way", () => {
    for (const href of [
      "data:text/html;base64,PHNjcmlwdD4=",
      "file:///etc/passwd",
      "//example.test/x",
      "/configuration",
      "../admin",
    ]) {
      const body = drawn(`[t](${href})`);
      expect(body.querySelector("a"), href).toBeNull();
      expect(body.textContent, href).toContain("t");
      cleanup();
    }
  });

  it("an image on a refused scheme becomes a placeholder, never a request", () => {
    const body = drawn("![alt](javascript:alert(1))");
    expect(body.querySelector("img")).toBeNull();
    expect(body.textContent).toContain("[image]");
    const mailImage = drawn("![alt](mailto:a@example.test)");
    expect(mailImage.querySelector("img")).toBeNull();
  });
});

describe.skipIf(!REAL_SANITIZER)("the preview draws the same document, compact", () => {
  it("the same sanitized body, in a clipped container", () => {
    const markdown = "# Title\n\n- one\n- two\n\n[web](https://example.test/a)";
    const detailBody = drawn(markdown).innerHTML;
    cleanup();
    const { container } = render(
      <MarkdownArtifactPreview {...props(textContent(markdown))} />,
    );
    expect(container.querySelector("[data-markdown-body]")?.innerHTML).toBe(detailBody);
    expect(container.querySelector("[data-compact='true']")).not.toBeNull();
  });
});
