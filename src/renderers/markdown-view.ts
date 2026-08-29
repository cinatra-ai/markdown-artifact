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

  if (content.kind === "none") {
    if (content.reason === "over-cap") return floor("content-over-cap");
    if (content.reason === "unsupported-form") return floor("content-unsupported-form");
    return floor("content-absent");
  }

  if (content.kind !== "text") {
    return floor("content-not-text");
  }

  const text = typeof content.text === "string" ? content.text : "";

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
    revisionId: content.representationRevisionId,
    truncated: content.truncated === true,
    byteLength: typeof content.byteLength === "number" ? content.byteLength : 0,
    projectedByteLength:
      typeof content.projectedByteLength === "number" ? content.projectedByteLength : 0,
  };
}
