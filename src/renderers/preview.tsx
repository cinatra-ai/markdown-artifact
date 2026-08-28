// Markdown preview renderer (slot `preview`).
//
// DECLARED AND PUBLISHED, NOT YET DRAWABLE. The same refusal the detail entry
// makes, for the same reason: the display renders markdown through the SDK's
// markdown sanitizer leaf entry, and that entry is not published yet.
//
// v1 renderer: requests NO host ports; it will render ONLY from the
// host-supplied authorized snapshot (`ArtifactRendererProps`).
//
// TODO: import the markdown sanitizer leaf entry of `@cinatra-ai/sdk-ui` and
// render the sanitized document here, then delete the refusal below.

import type { ReactElement } from "react";

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { MARKDOWN_DISPLAY_UNAVAILABLE } from "../display-unavailable";

export default function MarkdownArtifactPreview(
  _props: ArtifactRendererProps,
): ReactElement {
  throw new Error(MARKDOWN_DISPLAY_UNAVAILABLE);
}
