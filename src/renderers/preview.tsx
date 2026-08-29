// Markdown PREVIEW renderer (slot `preview`) — the same document, compact.
//
// The `preview` slot is where a surface shows a document beside other things: a
// review card, a representation viewer, a list of work. It draws the SAME
// sanitized rendering the full view draws — one document, one appearance — in a
// clipped container, so a long draft takes a card's worth of room instead of the
// whole surface.
//
// v1 renderer: no host ports, no fetching, read-only, and the same named floors
// as the full view.

import type { ReactElement } from "react";

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { MarkdownDocument } from "./markdown-document";
import { resolveMarkdownView } from "./markdown-view";

export default function MarkdownArtifactPreview(props: ArtifactRendererProps): ReactElement {
  return <MarkdownDocument view={resolveMarkdownView(props)} slot="preview" compact />;
}
