// The row icon of this package's type: the shared icon set's `hash`, drawn at 17 pixels
// inside the cell the Artifacts list gives every row. The cell's size and tint stay the
// list's; this display draws the icon alone, from its props only, and returns the same
// icon for every object type it receives.

import { Hash } from "lucide-react";
import type { ReactElement } from "react";

export default function MarkdownArtifactListRow(
  // The props' shape is written here rather than imported from the SDK: the SDK is host-provided and this repository's
  // standalone typecheck runs without it (tsconfig.json maps only the SDK sub-paths it needs to ./types fallbacks).
  _props: { artifact: { objectType: string } },
): ReactElement {
  return <Hash aria-hidden size={17} strokeWidth={2} data-row-glyph="hash" />;
}
