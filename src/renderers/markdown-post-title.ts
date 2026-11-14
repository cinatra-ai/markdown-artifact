// THE POST'S TITLE (cinatra-ai/cinatra#3978) - the title this display draws
// over a post's body, decided here and nowhere else.
//
// The drawing of the post's review says the markdown display renders "the post
// itself: its title and its body text", and its Preview puts the title over the
// body. A post's body never carries its title: the draft writer returns the
// title apart from the body and must not repeat it as a heading, and the host
// stores it on the artifact row. So the title reaches this display only as
// `artifact.title`. It reaches no sanitizer: it is drawn as plain text.

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { BLOG_POST_OBJECT_TYPE, type MarkdownRendererInput } from "./markdown-view-contract";

/**
 * The title of a post, trimmed, or null. Only a blog post is given a title by
 * this display: every other markdown document draws its body alone, as before.
 */
export function postTitle(props: MarkdownRendererInput): string | null {
  if (props === null || props === undefined || typeof props !== "object") return null;
  const artifact = (props as Partial<ArtifactRendererProps>).artifact;
  if (artifact === null || artifact === undefined || typeof artifact !== "object") return null;
  if (artifact.objectType !== BLOG_POST_OBJECT_TYPE) return null;
  if (typeof artifact.title !== "string") return null;
  const title = artifact.title.trim();
  return title.length > 0 ? title : null;
}

const isSpaceOrTab = (c: string | undefined): boolean => c === " " || c === "\t";
const isWhitespace = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);

/** The document's first non-blank line, or null. Lines end at LF, CR or CRLF,
 * the CommonMark line endings. */
function firstNonBlankLine(source: string): string | null {
  let start = 0;
  while (start < source.length) {
    let end = start;
    while (end < source.length && source[end] !== "\n" && source[end] !== "\r") end++;
    const line = source.slice(start, end);
    if (line.trim().length > 0) return line;
    start = end + (source[end] === "\r" && source[end + 1] === "\n" ? 2 : 1);
  }
  return null;
}

/** The text of the document's opening ATX heading under CommonMark, or null
 * when its first non-blank line is no ATX heading. That line holds at most
 * three leading spaces and no tab, then one to six `#`, then a space, a tab or
 * the line's end; a line indented further is indented code, and a setext
 * heading is not read here. The text is the rest of the line without its
 * leading and trailing spaces and tabs, and without an optional closing run of
 * `#` that is either all of that text or follows a space or tab. An empty
 * heading answers "". A plain scan, linear in the line's length. */
function openingHeading(source: string): string | null {
  const line = firstNonBlankLine(source);
  if (line === null) return null;
  let i = 0;
  while (i < 3 && line[i] === " ") i++;
  let hashes = 0;
  while (line[i + hashes] === "#") hashes++;
  if (hashes < 1 || hashes > 6) return null;
  i += hashes;
  if (i < line.length && !isSpaceOrTab(line[i])) return null;
  let lo = i;
  let hi = line.length;
  while (lo < hi && isSpaceOrTab(line[lo])) lo++;
  while (hi > lo && isSpaceOrTab(line[hi - 1])) hi--;
  let run = hi;
  while (run > lo && line[run - 1] === "#") run--;
  if (run < hi && (run === lo || isSpaceOrTab(line[run - 1]))) {
    hi = run;
    while (hi > lo && isSpaceOrTab(line[hi - 1])) hi--;
  }
  return line.slice(lo, hi);
}

/** Characters with inline meaning in markdown. A title holding any of them is
 * never handed to the body's heading: the display draws it as plain text. */
const INLINE_MARKUP = /[\\`*_~[\]<>&]/;

/** Emphasis and strong emphasis delimiters, longest first for each character. */
const EMPHASIS_DELIMITERS = ["***", "**", "*", "___", "__", "_"];

/** True when the heading's text is the title, either as written or wrapped
 * whole in emphasis or strong emphasis (`*`, `_`, nested; no whitespace just
 * inside the delimiters) or in a code span between equal backtick fences
 * (the title, or the title padded by one space; a code span ends the read),
 * for a title with no inline markup. Each step strips at most two delimiters
 * by index and does constant work, so the read is linear in the heading. */
function headingShowsTitle(heading: string, title: string): boolean {
  if (INLINE_MARKUP.test(title)) return false;
  let lo = 0;
  let hi = heading.length;
  for (;;) {
    if (hi - lo === title.length && heading.startsWith(title, lo)) return true;
    if (heading[lo] === "`") {
      let open = 0;
      while (lo + open < hi && heading[lo + open] === "`") open++;
      let close = 0;
      while (hi - close - 1 >= lo + open && heading[hi - close - 1] === "`") close++;
      if (open !== close) return false;
      const inner = heading.slice(lo + open, hi - close);
      return inner === title || inner === ` ${title} `;
    }
    let width = 0;
    for (const delimiter of EMPHASIS_DELIMITERS) {
      const n = delimiter.length;
      if (
        hi - lo >= 2 * n + 1 &&
        heading.startsWith(delimiter, lo) &&
        heading.startsWith(delimiter, hi - n) &&
        !isWhitespace(heading[lo + n]) &&
        !isWhitespace(heading[hi - n - 1])
      ) {
        width = n;
        break;
      }
    }
    if (width === 0) return false;
    lo += width;
    hi -= width;
  }
}

/**
 * The title to draw over this document, or null. The title is dropped only
 * when the document's first non-blank line is an ATX heading (levels 1 to 6)
 * whose text is the title exactly, or the title wrapped whole in emphasis or a
 * code span, and the title holds none of the characters backslash, backtick,
 * `*`, `_`, `~`, `[`, `]`, `<`, `>` and `&`.
 * The body's own heading then shows the title's words. Every other document
 * keeps the title: an empty opening heading (`#`, or `# #`, whose closing
 * sequence is all of it) and a setext opening heading included.
 */
export function titleOverDocument(title: string | null, source: unknown): string | null {
  if (title === null) return null;
  if (typeof source !== "string") return title;
  const heading = openingHeading(source);
  if (heading !== null && headingShowsTitle(heading, title)) return null;
  return title;
}
