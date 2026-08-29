// One authorized-snapshot fixture, shaped exactly as the host builds it, so
// every suite pins the same props shape and a field the host stopped sending
// fails in one place.

import type { ArtifactContentProjection } from "../src/artifact-content-channel";
import type { ArtifactRendererProps } from "../src/artifact-renderer-props";

export function textContent(
  text: string,
  overrides: Partial<Extract<ArtifactContentProjection, { kind: "text" }>> = {},
): ArtifactContentProjection {
  const byteLength = Buffer.byteLength(text, "utf8");
  return {
    kind: "text",
    channelVersion: 1,
    representationRevisionId: "rev_1",
    text,
    encoding: "utf-8",
    byteLength,
    projectedByteLength: byteLength,
    cap: 256 * 1024,
    truncated: false,
    ...overrides,
  };
}

export function props(
  content: ArtifactContentProjection,
  overrides: Partial<ArtifactRendererProps> = {},
): ArtifactRendererProps {
  return {
    propsApiVersion: 1,
    artifact: {
      id: "art_1",
      title: "A draft",
      objectType: "@cinatra-ai/markdown-artifact:artifact",
      mime: "text/markdown",
      size: 2048,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ownerLevel: "workspace",
      visibility: "organization",
      sourceUrl: null,
    },
    representation: { revisionId: "rev_1", mime: "text/markdown" },
    urls: { preview: "/preview", download: "/download" },
    identity: { kind: "extension", extension: "@cinatra-ai/markdown-artifact" },
    actions: { download: "/download", openInSource: null },
    content,
    ...overrides,
  };
}
