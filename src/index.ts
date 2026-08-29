// `@cinatra-ai/markdown-artifact` — the system base for markdown. It accepts
// `text/markdown` and nothing else, and it claims a dedicated type so a markdown
// document lands in the artifact library under its own identity rather than
// inside a general text type.
//
// A renderer artifact: it declares its accepted upload MIME set, a `detail` and
// a `preview` v1 display, and a dedicated `objectTypes` claim
// (`@cinatra-ai/markdown-artifact:artifact`) so the upload pipeline can map the
// accepted MIME to exactly this type (the exactly-one-or-refuse resolver). The
// accepted MIME set is DISJOINT from every other base — this one claims markdown
// alone.
//
// THE TWO DISPLAYS DRAW. Both receive the pinned markdown on their props,
// through the versioned server content channel, and render it through the SDK's
// shared markdown sanitizer leaf entry — the fleet's one sanitizer, so this
// package carries none of its own. Both are read-only: they draw the document as
// it was stored at the pinned revision, and offer no editing affordance.
//
// The AUTHORITATIVE manifest is the `cinatra` block in `package.json` (what the
// host install pipeline + the marketplace publish gate read), and each display
// is published through this package's own `exports` at the key the host's
// manifest generator derives from the display entry. This module re-declares
// the `artifact` descriptor as a typed value for programmatic use; the manifest
// test keeps the two in agreement.

export {
  type ArtifactRendererProps,
  ARTIFACT_RENDERER_PROPS_API_VERSION,
} from "./artifact-renderer-props";

export {
  type ArtifactContentProjection,
  type ArtifactContentAbsence,
  type ArtifactContentClass,
  ARTIFACT_CONTENT_CHANNEL_VERSION,
} from "./artifact-content-channel";

export {
  type MarkdownView,
  type MarkdownFloorReason,
  MARKDOWN_DISPLAY_PROPS_API_VERSION,
  markdownFloorMessage,
  resolveMarkdownView,
} from "./renderers/markdown-view";

/** The closed v1 renderer-slot names — the WHOLE enum the host contract
 * defines, not just the ones this base declares. Mirrored in full so a consumer
 * typing against this module can express any conforming manifest; which slots
 * THIS base ships is said by `renderers` below. */
export type ArtifactUiSlot = "detail" | "preview" | "listRow";

/** A single slot renderer. v1 requests NO host ports — only these three keys. */
export interface ArtifactUiRenderer {
  entry: string;
  propsApiVersion: number;
  representations?: string[];
}

export interface ArtifactUiManifest {
  abiVersion: 1;
  sdkAbiRange: string;
  renderers: Partial<Record<ArtifactUiSlot, ArtifactUiRenderer>>;
}

export interface MarkdownArtifactManifest {
  accepts: { file: { mimeTypes: string[] } };
  ui: ArtifactUiManifest;
}

export const markdownArtifactManifest: MarkdownArtifactManifest = {
  accepts: {
    file: {
      mimeTypes: ["text/markdown"],
    },
  },
  ui: {
    abiVersion: 1,
    sdkAbiRange: "^2.5.0",
    renderers: {
      detail: {
        entry: "./src/renderers/detail.tsx",
        propsApiVersion: 1,
        representations: ["text/markdown"],
      },
      preview: {
        entry: "./src/renderers/preview.tsx",
        propsApiVersion: 1,
        representations: ["text/markdown"],
      },
    },
  },
};
