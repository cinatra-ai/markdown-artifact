"use client";

// Markdown DETAIL renderer (slot `detail`) — the full view of a markdown
// document, with its two tabs.
//
// WHAT IT DRAWS (enabler 0.20 of `PLAN: Agents Lifecycle (C)`, cinatra#3026):
// the Code tab, showing the markdown as it is written and syntax-highlighted,
// and the Preview tab, showing the same document rendered to safe html by the
// SDK's shared markdown sanitizer. Only the active tab's view is on screen; the
// two are never side by side.
//
// EDITABLE ONLY WHERE THE HOST SAYS SO. The host hands this display an EDIT
// CAPABILITY on its props: a grant, minted by the artifact's own page for a
// reader with write rights, or a NAMED REFUSAL, minted by every other surface —
// the review card above all. This module makes no judgement of its own about who
// may write: it draws what the capability says. That is what makes "the review
// card shows the same display read-only" a property of the props rather than of
// this file remembering to behave.
//
// A CLIENT COMPONENT, because editing in place is: the caret, the idle pause and
// the saving indicator are all browser-side. It still requests NO host ports and
// still never fetches its own content — the document arrives on the props
// through the versioned server content channel, which is what lets this display
// draw inside a third-party application.
//
// NEVER BLANK, NEVER THROWN: content it cannot draw becomes a named floor, and
// a floor has no tabs — there is nothing to switch between.

import type { ReactElement } from "react";

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { MarkdownDocument } from "./markdown-document";
import { MarkdownTabbedDisplay } from "./markdown-tabs";
import { resolveMarkdownView } from "./markdown-view";

export default function MarkdownArtifactDetail(props: ArtifactRendererProps): ReactElement {
  const view = resolveMarkdownView(props);
  if (view.kind === "floor") {
    return <MarkdownDocument view={view} slot="detail" compact={false} />;
  }
  return (
    <MarkdownTabbedDisplay view={view} edit={props.edit} slot="detail" />
  );
}
