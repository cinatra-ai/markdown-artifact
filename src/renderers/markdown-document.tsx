// The drawn document, and the floor beside it — the chrome the markdown slots
// share, so the full view and the compact one can never disagree about what a
// markdown document looks like or about what they say when there is none.
//
// THE ONE INJECTION POINT. The html handed to `MarkdownBody` below comes from
// the SDK's shared markdown sanitizer and from nowhere else: the sanitizer is
// the boundary, and nothing downstream re-sanitizes. Keeping the injection in
// ONE component is what makes that reviewable — a second injection anywhere in
// this package would be a second, unreviewed road for a document's own bytes
// into the page, and the package's own test refuses one. The tabbed display
// beside this module draws its Preview through THIS component for exactly that
// reason.
//
// READ-ONLY, HERE. This module draws and nothing else: no tabs, no editing
// affordance, no save. The editable Code view lives in `markdown-tabs.tsx`,
// which draws the document itself through the body below.

import type { ReactElement } from "react";

import { markdownFloorMessage, type MarkdownView } from "./markdown-view";

export type MarkdownSlot = "detail" | "preview";

/** The compact slot clips the document instead of growing the card it sits in. */
const COMPACT_BODY_CLASSES = "max-h-72 overflow-hidden";
const FULL_BODY_CLASSES = "max-w-none";

/**
 * THE ONE ROAD FROM A SANITIZED STRING INTO THE PAGE. Every surface in this
 * package that shows a rendered document goes through this component.
 */
export function MarkdownBody({
  html,
  compact,
}: {
  html: string;
  compact: boolean;
}): ReactElement {
  return (
    <div
      data-markdown-body=""
      className={`markdown-body text-sm leading-relaxed ${compact ? COMPACT_BODY_CLASSES : FULL_BODY_CLASSES}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * What a document says when the content channel could only carry part of it.
 * Shared, so the plain reading and the tabbed one say it in the same words —
 * and so the tabbed one cannot quietly drop it, which would leave a person
 * editing a prefix of their own document without being told.
 */
export function MarkdownTruncationNote({
  byteLength,
  projectedByteLength,
}: {
  byteLength: number;
  projectedByteLength: number;
}): ReactElement {
  return (
    <p className="mt-4 text-xs text-muted-foreground">
      {`Showing the first ${projectedByteLength.toLocaleString("en-US")} of ${byteLength.toLocaleString("en-US")} bytes of this document. Download it to read the whole document.`}
    </p>
  );
}

export function MarkdownDocument({
  view,
  slot,
  compact,
}: {
  view: MarkdownView;
  slot: MarkdownSlot;
  compact: boolean;
}): ReactElement {
  if (view.kind === "floor") {
    return (
      <article
        className="soft-panel rounded-card overflow-hidden p-6 text-sm text-muted-foreground"
        data-artifact-renderer="markdown"
        data-slot={slot}
        data-floor={view.reason}
      >
        {markdownFloorMessage(view.reason)}
      </article>
    );
  }

  return (
    <article
      className="soft-panel rounded-card overflow-hidden p-6"
      data-artifact-renderer="markdown"
      data-slot={slot}
      data-revision={view.revisionId}
      {...(compact ? { "data-compact": "true" } : {})}
      {...(view.truncated ? { "data-truncated": "true" } : {})}
    >
      <MarkdownBody html={view.html} compact={compact} />
      {view.truncated ? (
        <MarkdownTruncationNote
          byteLength={view.byteLength}
          projectedByteLength={view.projectedByteLength}
        />
      ) : null}
    </article>
  );
}
