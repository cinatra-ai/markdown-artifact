// The SHAPE of the SDK's artifact-edit-channel leaf entry, for this
// repository's own typecheck ONLY.
//
// The save road is host-provided: the host resolves
// `@cinatra-ai/sdk-extensions/artifact-edit-channel` when it builds this
// display, and a standalone extension repository cannot resolve the SDK at all.
// So the repository's tsconfig resolves that specifier to the real SDK source
// when one is installed and, when none is, to this declaration — the signature
// and nothing else. There is no implementation here and there must never be
// one: the whole point of the leaf entry is that a display does not carry its
// own road to the store.

export interface ArtifactEditSaveDeps {
  fetch?: typeof fetch;
  signal?: AbortSignal;
}

export declare function saveArtifactEdit(
  capability: unknown,
  text: string,
  deps?: ArtifactEditSaveDeps,
): Promise<
  | { outcome: "saved"; revisionId: string; revision: number }
  | { outcome: "unchanged"; revisionId: string }
  | {
      outcome: "stale";
      latestRevisionId: string;
      latestRevision: number;
      text: string;
      truncated: boolean;
    }
  | { outcome: "refused"; reason: string }
  | { outcome: "failed"; reason: string }
>;

export declare function artifactEditMessage(outcome: unknown): string | null;
