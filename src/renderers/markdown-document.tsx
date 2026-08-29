// The drawn document, and the floor beside it — the chrome both markdown slots
// share, so the full view and the compact one can never disagree about what a
// markdown document looks like or about what they say when there is none.
//
// THE ONE INJECTION POINT. The html handed to the container below comes from the
// SDK's shared markdown sanitizer and from nowhere else: the sanitizer is the
// boundary, and nothing downstream re-sanitizes. Keeping the injection in ONE
// component is what makes that reviewable — a second injection anywhere in this
// package would be a second, unreviewed road for a document's own bytes into the
// page, and the package's own test refuses one.
//
// READ-ONLY. Both slots draw and nothing else: no tabs, no editing affordance,
// no save. The document is shown as it was stored at the pinned revision.

import type { ReactElement } from "react";

import { markdownFloorMessage, type MarkdownView } from "./markdown-view";

export type MarkdownSlot = "detail" | "preview";

/** The compact slot clips the document instead of growing the card it sits in. */
const COMPACT_BODY_CLASSES = "max-h-72 overflow-hidden";
const FULL_BODY_CLASSES = "max-w-none";

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
      <div
        data-markdown-body=""
        className={`markdown-body text-sm leading-relaxed ${compact ? COMPACT_BODY_CLASSES : FULL_BODY_CLASSES}`}
        dangerouslySetInnerHTML={{ __html: view.html }}
      />
      {view.truncated ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {`Showing the first ${view.projectedByteLength.toLocaleString("en-US")} of ${view.byteLength.toLocaleString("en-US")} bytes of this document. Download it to read the whole document.`}
        </p>
      ) : null}
    </article>
  );
}
