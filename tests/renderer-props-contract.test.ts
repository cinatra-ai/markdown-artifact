// The local props copy exists because the SDK does not resolve from a
// standalone extension repository, and it must stay equal to the SDK leaf it
// copies.
//
// WHAT THESE ASSERTIONS ACTUALLY PROVE, said plainly: they freeze this copy's
// own unions and shape as runtime values and typecheck a snapshot literal
// shaped as the host builds one, so a change to THIS copy that nobody meant
// fails here. They do not read the SDK — nothing in this repository can, with
// the SDK absent — so they are not a comparison against the leaf. The
// leaf-versus-host comparison is the mutual-assignability pin that lives beside
// the leaf itself; this file is the copy's own guard rail, and the values below
// are the ones to update when the leaf moves.

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_CONTENT_ABSENCES,
  ARTIFACT_CONTENT_CHANNEL_VERSION,
  ARTIFACT_CONTENT_CLASSES,
} from "../src/artifact-content-channel";
import {
  ARTIFACT_EDIT_CHANNEL_VERSION,
  ARTIFACT_EDIT_REFUSALS,
} from "../src/artifact-edit-channel";
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

  it("carries the edit channel's version, and spells its refusals exactly as the contract does", () => {
    expect(ARTIFACT_EDIT_CHANNEL_VERSION).toBe(1);
    expect([...ARTIFACT_EDIT_REFUSALS]).toEqual([
      "no-write-rights",
      "read-only-surface",
      "unsupported-form",
      "no-representation",
      "content-truncated",
    ]);
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
      content: {
        kind: "none",
        channelVersion: ARTIFACT_CONTENT_CHANNEL_VERSION,
        representationRevisionId: null,
        reason: "absent",
      },
      edit: {
        kind: "read-only",
        channelVersion: ARTIFACT_EDIT_CHANNEL_VERSION,
        reason: "read-only-surface",
      },
    };
    expect(snapshot.artifact.ownerLevel).toBe("user");
    expect(snapshot.identity.kind).toBe("extension");
  });
});

describe("the content-channel contract copy", () => {
  it("carries the channel version the host builds a projection at", () => {
    expect(ARTIFACT_CONTENT_CHANNEL_VERSION).toBe(1);
  });

  it("spells the three content classes exactly as the contract does", () => {
    expect([...ARTIFACT_CONTENT_CLASSES]).toEqual(["text", "configuration", "page"]);
  });

  it("spells every named absence exactly as the contract does", () => {
    expect([...ARTIFACT_CONTENT_ABSENCES]).toEqual(["unsupported-form", "absent", "over-cap"]);
  });

  it("accepts a text projection shaped exactly as the host builds one", () => {
    const content: ArtifactRendererProps["content"] = {
      kind: "text",
      channelVersion: 1,
      representationRevisionId: "rev-1",
      text: "# a draft",
      encoding: "utf-8",
      byteLength: 9,
      projectedByteLength: 9,
      cap: 262144,
      truncated: false,
    };
    expect(content.kind).toBe("text");
  });
});
