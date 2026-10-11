// The row icon of this package's type: the shared icon set's `hash`, drawn at 17 pixels
// inside the cell the Artifacts list gives every row. The cell's size and tint stay the
// list's; this display draws the icon alone, from its props only, and returns the same
// icon for every object type it receives.

import type { ArtifactRendererProps } from "@cinatra-ai/sdk-extensions";
import { Hash } from "lucide-react";
import type { ReactElement } from "react";

export default function MarkdownArtifactListRow(
  _props: { artifact: Pick<ArtifactRendererProps["artifact"], "objectType"> },
): ReactElement {
  return <Hash aria-hidden size={17} strokeWidth={2} data-row-glyph="hash" />;
}
