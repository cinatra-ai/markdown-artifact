// Markdown DETAIL renderer (slot `detail`) — the full view of a markdown
// document on the artifact page.
//
// It draws the markdown the content channel pinned, rendered to safe html by the
// SDK's shared markdown sanitizer. It is READ-ONLY: the document as it was
// stored at that revision, with no tabs and no editing affordance.
//
// v1 renderer: it requests NO host ports and it never fetches. Everything it
// draws comes from the host-supplied authorized snapshot, whose content field
// carries the pinned text — which is what lets this display draw inside a
// third-party application, where a display that reached for bytes itself paints
// nothing.
//
// NEVER BLANK, NEVER THROWN: content it cannot draw becomes a named floor.

import type { ReactElement } from "react";

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { MarkdownDocument } from "./markdown-document";
import { resolveMarkdownView } from "./markdown-view";

export default function MarkdownArtifactDetail(props: ArtifactRendererProps): ReactElement {
  return <MarkdownDocument view={resolveMarkdownView(props)} slot="detail" compact={false} />;
}
