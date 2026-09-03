// THE CODE VIEW'S HIGHLIGHTER — the markdown the person is editing, drawn with
// its own syntax visible.
//
// THE DRAWING ASKS FOR THIS BY NAME: "Code shows the markdown as it is written —
// SYNTAX-HIGHLIGHTED, never plain text: the application's own highlighter, with
// the application's own light and dark colours."
//
// WHY THIS PACKAGE CARRIES ITS OWN, AND TAKES NO DEPENDENCY. A general grammar
// engine (a highlighter shipping a language grammar per language, or one that
// fetches a grammar at run time) buys nothing here and costs a great deal: this
// view highlights exactly ONE language, in five token classes, inside a display
// that must bundle whole and reach no network at run time — an extension display
// that fetched a grammar would paint nothing inside a third-party application,
// which is the failure the whole content channel exists to prevent. So the
// tokenizer is ~120 lines, it is a dependency of nothing, and it is tested here.
//
// THE INVARIANT THAT MAKES THE EDITOR POSSIBLE: the spans this returns
// CONCATENATE BACK TO THE INPUT, character for character. The editable code view
// is a transparent textarea over a highlighted `<pre>`; if the highlighted text
// differed from the text by even one character, the caret and the letters under
// it would drift apart. The package's own test pins that for every input it
// tries, and nothing here ever drops, inserts or rewrites a character — the
// markers are KEPT and coloured, never hidden.

/** The five classes the drawing colours, plus the uncoloured remainder. */
export type MarkdownTokenKind =
  | "text"
  | "heading"
  | "strong"
  | "emphasis"
  | "code"
  | "link"
  | "marker";

export interface MarkdownToken {
  text: string;
  kind: MarkdownTokenKind;
}

/** A fence opens and closes on a line of three or more backticks or tildes. */
const FENCE = /^\s{0,3}(?:`{3,}|~{3,})/;
const HEADING = /^\s{0,3}#{1,6}\s/;
const LIST_MARKER = /^(\s*)([-*+]\s|\d{1,9}[.)]\s)/;
const QUOTE_MARKER = /^(\s*)(>\s?)/;

/**
 * The inline scanner, in ONE regular expression with named alternatives, so a
 * single left-to-right pass covers the line and everything it does not match
 * stays plain text. Order matters: code spans win over emphasis, so a `**` that
 * lives inside backticks is never read as bold.
 */
const INLINE =
  /(`+[^`]*`+)|(\[[^\]\n]*\]\([^)\n]*\))|(\*\*[^*\n]+\*\*|__[^_\n]+__)|(\*[^*\n]+\*|_[^_\n]+_)/g;

function pushText(out: MarkdownToken[], text: string): void {
  if (text.length === 0) return;
  const last = out[out.length - 1];
  if (last && last.kind === "text") last.text += text;
  else out.push({ text, kind: "text" });
}

function scanInline(out: MarkdownToken[], line: string): void {
  let at = 0;
  INLINE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE.exec(line)) !== null) {
    pushText(out, line.slice(at, match.index));
    const [whole, code, link, strong, emphasis] = match;
    const kind: MarkdownTokenKind = code
      ? "code"
      : link
        ? "link"
        : strong
          ? "strong"
          : emphasis
            ? "emphasis"
            : "text";
    out.push({ text: whole, kind });
    at = match.index + whole.length;
  }
  pushText(out, line.slice(at));
}

/**
 * Tokenize markdown for the code view.
 *
 * TOTAL: every character of `source` appears exactly once, in order, in the
 * result. A construct the tokenizer does not know is plain text, never a
 * dropped character.
 */
export function highlightMarkdown(source: string): MarkdownToken[] {
  const out: MarkdownToken[] = [];
  const lines = source.split("\n");
  let inFence = false;

  lines.forEach((line, index) => {
    const isFenceLine = FENCE.test(line);
    if (isFenceLine) {
      out.push({ text: line, kind: "code" });
      inFence = !inFence;
    } else if (inFence) {
      // Inside a fence nothing is markdown — a `#` there is a comment in
      // somebody's shell snippet, and colouring it as a heading would be a lie
      // about their code.
      out.push({ text: line, kind: "code" });
    } else if (HEADING.test(line)) {
      out.push({ text: line, kind: "heading" });
    } else {
      const quote = QUOTE_MARKER.exec(line);
      const list = quote ? null : LIST_MARKER.exec(line);
      const marker = quote ?? list;
      if (marker) {
        pushText(out, marker[1]);
        out.push({ text: marker[2], kind: "marker" });
        scanInline(out, line.slice(marker[0].length));
      } else {
        scanInline(out, line);
      }
    }
    if (index < lines.length - 1) pushText(out, "\n");
  });

  return out;
}

/** The concatenation invariant, as a function, so the display and the test ask
 *  the same question rather than two similar ones. */
export function tokensJoin(tokens: readonly MarkdownToken[]): string {
  return tokens.map((t) => t.text).join("");
}
