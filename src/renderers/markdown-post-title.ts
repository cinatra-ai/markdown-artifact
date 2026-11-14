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

/** The raw text of the document's first non-blank line when that line is an
 * ATX heading under CommonMark (at most three leading spaces and no tab before
 * one to six `#`, then a space or tab), or null. A line indented further is
 * indented code, and a setext heading is not read here. */
function openingHeading(source: string): string | null {
  for (const line of source.split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const match = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    return match ? match[1] : null;
  }
  return null;
}

/** Characters with inline meaning in markdown. A title holding any of them is
 * never handed to the body's heading: the display draws it as plain text. */
const INLINE_MARKUP = /[\\`*_~[\]<>&]/;

/** Wrappers whose rendering shows the inner text as written: emphasis and
 * strong emphasis (`*`, `_`, nested), and a code span, which ends the read. */
const EMPHASIS = /^(\*\*\*|\*\*|\*|___|__|_)(\S(?:.*\S)?)\1$/;
const CODE_SPAN = /^(`+)(.+)\1$/;

/** True when the heading's text is the title, either as written or wrapped
 * whole in emphasis or a code span, for a title with no inline markup. */
function headingShowsTitle(heading: string, title: string): boolean {
  if (INLINE_MARKUP.test(title)) return false;
  let text = heading;
  for (;;) {
    if (text === title) return true;
    const code = CODE_SPAN.exec(text);
    if (code) {
      const inner = code[2];
      return inner === title || inner === ` ${title} `;
    }
    const emphasis = EMPHASIS.exec(text);
    if (!emphasis) return false;
    text = emphasis[2];
  }
}

/**
 * The title to draw over this document, or null. The title is dropped only
 * when the document's first non-blank line is an ATX heading (levels 1 to 6)
 * whose text is the title exactly, or the title wrapped whole in emphasis or a
 * code span, and the title holds none of the characters backslash, backtick,
 * `*`, `_`, `~`, `[`, `]`, `<`, `>` and `&`.
 * The body's own heading then shows the title's words. Every other document,
 * a setext opening heading included, keeps the title.
 */
export function titleOverDocument(title: string | null, source: unknown): string | null {
  if (title === null) return null;
  if (typeof source !== "string") return title;
  const heading = openingHeading(source);
  if (heading !== null && headingShowsTitle(heading, title)) return null;
  return title;
}
