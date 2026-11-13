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

/** The text of the document's first non-blank line when that line is an ATX
 * heading, or null. */
function openingHeading(source: string): string | null {
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const match = /^#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    return match ? match[1].trim() : null;
  }
  return null;
}

/**
 * The title to draw over this document, or null. A document that already
 * opens with the title as its heading draws it once, from its own markdown.
 */
export function titleOverDocument(title: string | null, source: unknown): string | null {
  if (title === null) return null;
  if (typeof source === "string" && openingHeading(source) === title) return null;
  return title;
}
