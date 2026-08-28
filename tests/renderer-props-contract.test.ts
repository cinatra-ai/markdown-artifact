// The local props copy must stay EXACTLY equal to the SDK leaf it copies. These
// assertions are the drift detector: the string unions are frozen as runtime
// values, and a canonical-shaped snapshot must both typecheck and be accepted.

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_OWNER_LEVELS,
  ARTIFACT_RENDERER_PROPS_API_VERSION,
  ARTIFACT_VISIBILITIES,
  EFFECTIVE_IDENTITY_KINDS,
  type ArtifactRendererProps,
} from "../src/artifact-renderer-props";

describe("the renderer-props contract copy", () => {
  it("carries the props ABI version the manifest entries declare", () => {
    expect(ARTIFACT_RENDERER_PROPS_API_VERSION).toBe(1);
  });

  it("spells the ownership levels exactly as the contract does", () => {
    expect([...ARTIFACT_OWNER_LEVELS]).toEqual(["user", "team", "organization", "workspace"]);
  });

  it("spells the visibilities exactly as the contract does", () => {
    expect([...ARTIFACT_VISIBILITIES]).toEqual(["private", "team", "organization", "public"]);
  });

  it("carries only the two identity kinds the contract still defines", () => {
    expect([...EFFECTIVE_IDENTITY_KINDS]).toEqual(["extension", "no-primary"]);
  });

  it("does not carry the retired identity fields", () => {
    const identity: ArtifactRendererProps["identity"] = { kind: "no-primary", extension: null };
    expect(Object.keys(identity).sort()).toEqual(["extension", "kind"]);
  });

  it("accepts a snapshot shaped exactly as the host builds one", () => {
    // This literal is the assertion: it fails the typecheck if this copy asks
    // for a field the host does not send, or spells a union the host does not.
    const snapshot: ArtifactRendererProps = {
      propsApiVersion: 1,
      artifact: {
        id: "artifact-1",
        title: "A file",
        objectType: "@cinatra-ai/x:artifact",
        mime: "application/octet-stream",
        size: 1024,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ownerLevel: "user",
        visibility: "organization",
        sourceUrl: null,
      },
      representation: { revisionId: "rev-1", mime: "application/octet-stream" },
      urls: { preview: null, download: "https://example.test/d" },
      identity: { kind: "extension", extension: "@cinatra-ai/x" },
      actions: { download: "https://example.test/d", openInSource: null },
    };
    expect(snapshot.artifact.ownerLevel).toBe("user");
    expect(snapshot.identity.kind).toBe("extension");
  });
});
