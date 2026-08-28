// Markdown detail renderer (slot `detail`).
//
// DECLARED AND PUBLISHED, NOT YET DRAWABLE. The display renders markdown through
// the SDK's markdown sanitizer leaf entry; that entry is not published yet, so
// this entry throws instead of rendering. It never returns a partial view, a
// placeholder panel or raw markdown: a display that drew markdown any other way
// would be a second sanitizer in the fleet, and one shipped inside an extension
// at that.
//
// v1 renderer: requests NO host ports; it will render ONLY from the
// host-supplied authorized snapshot (`ArtifactRendererProps`).
//
// TODO: import the markdown sanitizer leaf entry of `@cinatra-ai/sdk-ui` and
// render the sanitized document here, then delete the refusal below.

import type { ReactElement } from "react";

import type { ArtifactRendererProps } from "../artifact-renderer-props";
import { MARKDOWN_DISPLAY_UNAVAILABLE } from "../display-unavailable";

export default function MarkdownArtifactDetail(
  _props: ArtifactRendererProps,
): ReactElement {
  throw new Error(MARKDOWN_DISPLAY_UNAVAILABLE);
}
