// The decision leaf both markdown slots share: it maps the authorized snapshot
// to exactly one of two outcomes, and it is the ONE module in this package that
// reaches the sanitizer.
//
//   `document` — the pinned markdown, already rendered to safe html by the SDK's
//     shared markdown sanitizer, with what the channel said about it (the pinned
//     revision, and whether the host cut the text to its cap).
//   `floor` — a NAMED reason the document cannot be drawn. Never blank, never a
//     throw: a display that threw would take the artifact page down with it.
//
// NOTHING IS SANITIZED HERE. The html comes from the one shared sanitizer and
// from nowhere else; this module chooses whether to ask for it and what to say
// when there is nothing to ask about.
//
// HEADINGS ARE DEMOTED on both slots: the surfaces that mount these displays —
// the artifact page and the review card — already own the only top-level
// heading, so a document's own `#` becomes the second level rather than a second
// first level.

import { renderSanitizedMarkdown } from "@cinatra-ai/sdk-extensions/markdown-sanitizer";

import { ARTIFACT_CONTENT_CHANNEL_VERSION } from "../artifact-content-channel";
import type { ArtifactRendererProps } from "../artifact-renderer-props";
import {
  MARKDOWN_DISPLAY_PROPS_API_VERSION,
  type MarkdownFloorReason,
  type MarkdownRendererInput,
  type MarkdownView,
} from "./markdown-view-contract";

export {
  MARKDOWN_DISPLAY_PROPS_API_VERSION,
  markdownFloorMessage,
} from "./markdown-view-contract";
export type {
  MarkdownFloorReason,
  MarkdownRendererInput,
  MarkdownView,
} from "./markdown-view-contract";

function floor(reason: MarkdownFloorReason): MarkdownView {
  return { kind: "floor", reason };
}

/** Resolve what to draw. Total: it returns a view for every input. */
export function resolveMarkdownView(props: MarkdownRendererInput): MarkdownView {
  if (props === null || props === undefined || typeof props !== "object" || Array.isArray(props)) {
    return floor("malformed-props");
  }

  const snapshot = props as Partial<ArtifactRendererProps>;

  // STRICT, in both directions: a snapshot that does not SAY which version it
  // was built at is as unreadable as one built at another version. The host
  // resolves the display and builds the snapshot at the version the display
  // declares, so a snapshot without that stamp is not one this display agreed
  // to read.
  if (snapshot.propsApiVersion !== MARKDOWN_DISPLAY_PROPS_API_VERSION) {
    return floor("props-version");
  }

  const content = snapshot.content;
  if (content === null || content === undefined || typeof content !== "object") {
    // The snapshot carried no projection at all — a surface that does not hand
    // its displays content. Held APART from a projection that says, itself,
    // that there is nothing stored: this display must never report an unwired
    // surface as an artifact with no document in it.
    return floor("content-unavailable");
  }

  // The channel's OWN version is checked before anything on the projection is
  // read, `none` included: a projection built at another channel version may
  // spell its own absence differently, and reading it at this shape would be a
  // guess.
  if (content.channelVersion !== ARTIFACT_CONTENT_CHANNEL_VERSION) {
    return floor("channel-version");
  }

  // THE PROJECTION IS VALIDATED BEFORE IT IS BELIEVED. At this channel version
  // the shape is known exactly, so a variant this display does not recognise —
  // an absence spelled a way the channel does not name, a class that is not one
  // of the four, a text projection missing a required field — is a projection
  // this display cannot read, and it says THAT rather than dressing it up as a
  // legitimate answer about the document.
  const projection = content as { [key: string]: unknown };
  const kind = projection.kind;

  if (kind === "none") {
    const reason = projection.reason;
    if (reason === "over-cap") return floor("content-over-cap");
    if (reason === "unsupported-form") return floor("content-unsupported-form");
    if (reason === "absent") return floor("content-absent");
    return floor("invalid-content-projection");
  }

  if (kind === "configuration" || kind === "page") {
    return floor("content-not-text");
  }

  if (kind !== "text") {
    return floor("invalid-content-projection");
  }

  const text = projection.text;
  const contentRevisionId = projection.representationRevisionId;
  const byteLength = projection.byteLength;
  const projectedByteLength = projection.projectedByteLength;
  const truncated = projection.truncated;
  if (
    typeof text !== "string" ||
    typeof contentRevisionId !== "string" ||
    contentRevisionId.length === 0 ||
    typeof byteLength !== "number" ||
    typeof projectedByteLength !== "number" ||
    typeof truncated !== "boolean" ||
    projection.encoding !== "utf-8"
  ) {
    return floor("invalid-content-projection");
  }

  // THE PINNED REVISION AND THE DRAWN REVISION ARE THE SAME ONE, or nothing is
  // drawn. The surface says which revision it is showing; the channel says
  // which revision it read the bytes from. If those disagree — or if the
  // artifact has no materialized representation at all while the projection
  // claims one — this display would be labelling one revision's bytes with
  // another's, and that is worse than drawing nothing.
  const representation = snapshot.representation as { revisionId?: unknown } | null | undefined;
  if (
    representation === null ||
    representation === undefined ||
    typeof representation !== "object" ||
    representation.revisionId !== contentRevisionId
  ) {
    return floor("content-revision-mismatch");
  }

  // A display that throws takes the surface around it down. The sanitizer is
  // the one call here that runs somebody else's document through a parser, so
  // a failure inside it becomes a named floor and nothing else: whatever went
  // wrong, no markup from a failed render is drawn.
  let html: string;
  try {
    html = renderSanitizedMarkdown(text, { demoteHeadings: true });
  } catch {
    return floor("render-failed");
  }
  if (typeof html !== "string" || html.trim().length === 0) {
    return floor("empty-document");
  }

  return {
    kind: "document",
    html,
    revisionId: contentRevisionId,
    truncated,
    byteLength,
    projectedByteLength,
  };
}
