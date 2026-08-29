// THE VERSIONED SERVER CONTENT CHANNEL, as this display reads it.
//
// The content a display draws arrives ON ITS PROPS, read from the pinned
// revision on the server and capped there: a display switches on `kind`, never
// infers a class from a mime, and never fetches. `none` is a first-class answer
// carrying a NAMED reason, which is why this display can always say what it is
// showing or why it is not.
//
// THE SOURCE OF TRUTH IS THE SDK LEAF `@cinatra-ai/sdk-extensions/artifact-content-channel`.
// This module is a LOCAL STRUCTURAL COPY of that leaf's TYPES, declared here —
// and not imported — for the same single reason the props copy beside it gives:
// the SDK is not resolvable from a standalone extension repository, so importing
// it would break this package's own install and typecheck. It copies types and
// two frozen enumerations ONLY: no cap arithmetic, no predicate, no behaviour.
// Replace it with a type-only import from the leaf as soon as the SDK resolves
// from a standalone repository.

/** The projection ABI version this display understands. A projection built at
 * another version is refused rather than read at the wrong shape. */
export const ARTIFACT_CONTENT_CHANNEL_VERSION = 1;

/** The three content classes the channel projects. */
export const ARTIFACT_CONTENT_CLASSES = ["text", "configuration", "page"] as const;
export type ArtifactContentClass = (typeof ARTIFACT_CONTENT_CLASSES)[number];

/** Why a projection carries no content. Named, never blank. */
export const ARTIFACT_CONTENT_ABSENCES = ["unsupported-form", "absent", "over-cap"] as const;
export type ArtifactContentAbsence = (typeof ARTIFACT_CONTENT_ABSENCES)[number];

/** The discriminated projection a display receives on its props. */
export type ArtifactContentProjection =
  | {
      kind: "text";
      channelVersion: number;
      /** The pinned revision the text was read from — never "latest". */
      representationRevisionId: string;
      /** The text itself, already decoded, always within the text cap. */
      text: string;
      encoding: "utf-8";
      /** Bytes of the FULL content, before any truncation. */
      byteLength: number;
      /** Bytes actually carried on this projection — what the cap binds. */
      projectedByteLength: number;
      /** The cap this projection was built under. */
      cap: number;
      /** True when `text` is a prefix of a larger content. */
      truncated: boolean;
    }
  | {
      kind: "configuration";
      channelVersion: number;
      representationRevisionId: string;
      configuration: unknown;
      digest: string;
      byteLength: number;
      projectedByteLength: number;
      cap: number;
    }
  | {
      kind: "page";
      channelVersion: number;
      representationRevisionId: string;
      pageVersion: number;
      page: unknown;
      byteLength: number;
      projectedByteLength: number;
      cap: number;
    }
  | {
      kind: "none";
      channelVersion: number;
      representationRevisionId: string | null;
      reason: ArtifactContentAbsence;
    };
