// THE POST'S CONTINUED READING (cinatra-ai/cinatra#3978) — the one sentence
// this display draws about a review, decided here and nowhere else.
//
// The drawing gives each type's continuation sentence to the type's own
// display, inside it and under the document; the host draws only the generic
// settled marker beneath the whole display. A blog post is drawn by this
// display, so the post's sentence is decided here. It reaches no sanitizer and
// no host module: it reads the snapshot and answers a sentence or nothing.

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import {
  BLOG_POST_OBJECT_TYPE,
  MARKDOWN_DETAIL_PROPS_API_VERSION,
  POST_CONTINUED_SENTENCE,
  type MarkdownRendererInput,
} from "./markdown-view-contract";

/** A decision time exactly as the host writes one: a canonical ISO instant. */
function isCanonicalInstant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/**
 * THE POST'S CONTINUED READING. The sentence is drawn only when every fact it
 * states is on the snapshot: a v5 snapshot of a blog post, a review in the
 * continued reading, and the decision time of the reviewed revision. A display
 * that is missing one of these facts draws no sentence. A surface that grants an
 * edit is not a review target, so it draws none either.
 */
export function postContinuedSentence(props: MarkdownRendererInput): string | null {
  if (props === null || props === undefined || typeof props !== "object") return null;
  const snapshot = props as Partial<ArtifactRendererProps>;
  if (snapshot.propsApiVersion !== MARKDOWN_DETAIL_PROPS_API_VERSION) return null;
  if (snapshot.artifact?.objectType !== BLOG_POST_OBJECT_TYPE) return null;
  if (snapshot.edit?.kind === "editable") return null;
  const review = snapshot.review;
  if (review === null || review === undefined || typeof review !== "object") return null;
  if (review.reading !== "continued") return null;
  if (!isCanonicalInstant(review.decidedAt)) return null;
  return POST_CONTINUED_SENTENCE;
}
