// THE VIEW CONTRACT — what a markdown display can be showing, and what it says
// when it is showing nothing.
//
// SANITIZER-FREE, DELIBERATELY. The view leaf beside this module reaches the
// host-provided sanitizer; this module reaches nothing at all. That is what
// keeps the package root importable and typecheckable with nothing installed: a
// consumer reading the contracts must not pull a host module in behind them.

import type { ArtifactRendererProps } from "../artifact-renderer-props";

/** The props-contract version these displays declare, and the only one they
 * accept a snapshot at. The manifest entries declare the same number, and the
 * host resolves the display and builds the snapshot at it. */
export const MARKDOWN_DISPLAY_PROPS_API_VERSION = 1;

export type MarkdownFloorReason =
  | "malformed-props"
  | "props-version"
  | "channel-version"
  | "content-unavailable"
  | "content-absent"
  | "content-over-cap"
  | "content-unsupported-form"
  | "content-not-text"
  | "empty-document"
  | "render-failed";

export type MarkdownView =
  | {
      kind: "document";
      /** Safe html from the shared sanitizer. Never the document's markdown. */
      html: string;
      /** The pinned revision the channel read the text from. */
      revisionId: string;
      truncated: boolean;
      byteLength: number;
      projectedByteLength: number;
    }
  | { kind: "floor"; reason: MarkdownFloorReason };

const FLOOR_MESSAGES: Record<MarkdownFloorReason, string> = {
  "malformed-props": "This markdown document cannot be drawn: the view was opened without a document to show.",
  "props-version": "This markdown document cannot be drawn: it was handed a document view of a version this display does not read.",
  "channel-version": "This markdown document cannot be drawn: its content arrived in a form of the content channel this display does not read.",
  "content-unavailable": "This markdown document cannot be drawn here: this view was not given the document to show.",
  "content-absent": "No markdown is available to show for the revision being viewed.",
  "content-over-cap": "This markdown document is too large to show here. Download it to read the whole document.",
  "content-unsupported-form": "This artifact is not markdown, so the markdown view has nothing to draw.",
  "content-not-text": "This artifact holds something other than a text document, so the markdown view has nothing to draw.",
  "empty-document": "This markdown document is empty.",
  "render-failed": "This markdown document could not be drawn. Download it to read the document.",
};

/** A display must never throw on a shape it did not expect, so the input is
 * accepted loosely and every surprise lands on the floor. */
export type MarkdownRendererInput = Partial<ArtifactRendererProps> | null | undefined;

/** The sentence a reader sees for a floor. One per reason, all distinct. */
export function markdownFloorMessage(reason: MarkdownFloorReason): string {
  return FLOOR_MESSAGES[reason] ?? FLOOR_MESSAGES["malformed-props"];
}
