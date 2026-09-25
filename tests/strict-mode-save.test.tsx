// THE CODE TAB'S EDIT, STORED UNDER THE DEVELOPMENT BUILD'S STRICT MODE.
//
// What this file pins: the markdown display mounted inside React's StrictMode —
// which a development build turns on, and which runs every effect as mount,
// cleanup, mount on the same component — still stores a change typed in the
// Code tab (one save, the indicator reads Saved, the root's revision advances),
// still shows the not-saved reading and its toast when the store refuses, and
// its Preview still draws a markdown link as a link element. The first two are
// the save road the page uses; the third is the sanitizer's output, injected as
// it is. Every arm mounts under StrictMode on purpose: that is the build in
// which the change set used to be dropped before it was ever sent.

import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import { ARTIFACT_EDIT_IDLE_PAUSE_MS } from "../src/artifact-edit-channel";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import {
  editSaveCalls,
  editSaveStub,
  resetArtifactEditChannelStub,
} from "./stubs/artifact-edit-channel-stub";
import { resetToastStub, toastCalls } from "./stubs/sdk-ui-toast-stub";
import {
  resetMarkdownSanitizerStub,
  sanitizerCalls,
  sanitizerStubState,
} from "./stubs/markdown-sanitizer-stub";
import { props, textContent } from "./props-fixture";
import { REAL_SANITIZER, REAL_SAVE_ROAD } from "./sanitizer-mode";

const SOURCE = "# A heading\n\nA paragraph with **bold** and `code`.\n";

const GRANT: ArtifactEditCapability = {
  kind: "editable",
  channelVersion: 1,
  artifactId: "art_1",
  baseRevisionId: "rev_1",
  saveUrl: "/api/artifacts/art_1/edit",
  idlePauseMs: ARTIFACT_EDIT_IDLE_PAUSE_MS,
  capBytes: 256 * 1024,
};

/** The display as the development build mounts it: inside StrictMode. */
function drawStrict(edit: ArtifactEditCapability, source = SOURCE) {
  return render(
    <StrictMode>
      <MarkdownArtifactDetail {...props(textContent(source), { edit })} />
    </StrictMode>,
  );
}

/** Let the idle pause elapse and every queued promise settle. */
async function idle(ms = ARTIFACT_EDIT_IDLE_PAUSE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

const root = () => document.querySelector("[data-artifact-renderer='markdown']");
const editor = () => screen.getByLabelText("Markdown source") as HTMLTextAreaElement;

beforeEach(() => {
  vi.useFakeTimers();
  resetArtifactEditChannelStub();
  resetToastStub();
  resetMarkdownSanitizerStub();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  // Everything this file changed on the shared doubles goes back as it was, so
  // the rest of the run sees the doubles in their opening state.
  resetArtifactEditChannelStub();
  resetToastStub();
  resetMarkdownSanitizerStub();
});

describe.skipIf(REAL_SAVE_ROAD)("a change typed in Code, under the development build's strict mode", () => {
  // Intent: StrictMode's mount, cleanup, mount must leave the display with a
  // queue that still takes edits, so one typed change set reaches the save road
  // once, the indicator turns to its check, and the root names the new revision.
  it("stores a change typed in Code under StrictMode", async () => {
    editSaveStub.defaultOutcome = { outcome: "saved", revisionId: "rev_2", revision: 2 };
    drawStrict(GRANT);
    expect(root()?.getAttribute("data-revision")).toBe("rev_1");

    fireEvent.change(editor(), { target: { value: "# Stored under strict mode\n" } });
    await idle();

    expect(editSaveCalls).toHaveLength(1);
    expect(editSaveCalls[0].text).toBe("# Stored under strict mode\n");
    const status = screen.getByRole("status");
    expect(status.getAttribute("data-saving-indicator")).toBe("saved");
    expect(status.textContent).toContain("Saved");
    expect(root()?.hasAttribute("data-display-state")).toBe(false);
    expect(root()?.getAttribute("data-revision")).toBe("rev_2");
  });

  // Intent: a refusal by the store is shown, not swallowed — the indicator reads
  // Not saved, the root's display state is the error one, exactly one error
  // toast carries the refusal's own sentence, and the typed text stays put.
  it("shows the not-saved reading and its toast when the store refuses, under StrictMode", async () => {
    editSaveStub.defaultOutcome = { outcome: "refused", reason: "no-write-rights" };
    drawStrict(GRANT);

    fireEvent.change(editor(), { target: { value: "# Refused under strict mode\n" } });
    await idle();

    expect(editSaveCalls).toHaveLength(1);
    const status = screen.getByRole("status");
    expect(status.getAttribute("data-saving-indicator")).toBe("not-saved");
    expect(status.textContent).toContain("Not saved");
    expect(root()?.getAttribute("data-display-state")).toBe("error");
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0]).toEqual({
      variant: "error",
      message: "This change has not been saved — you do not have rights to edit this artifact.",
    });
    expect(editor().value).toBe("# Refused under strict mode\n");
  });
});

describe.skipIf(REAL_SANITIZER)("the Preview, under the development build's strict mode", () => {
  // Intent: the Preview injects what the sanitizer returns for the TYPED text,
  // so a link the sanitizer draws is a real link element in the preview panel.
  // Which hrefs the shared sanitizer admits is its own rule, pinned against the
  // real leaf in tests/sanitizer-conformance.test.tsx.
  it("draws a markdown link in the Preview as a link element", () => {
    sanitizerStubState.html =
      '<p>See the <a href="https://example.com/upgrade">upgrade guide</a>.</p>';
    drawStrict(GRANT);

    const typed = "# Upgrading\n\nSee the [upgrade guide](https://example.com/upgrade).\n";
    fireEvent.change(editor(), { target: { value: typed } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(sanitizerCalls.at(-1)?.markdown).toBe(typed);
    const panel = document.querySelector("[data-panel='preview']");
    const link = panel?.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("href")).toBe("https://example.com/upgrade");
    expect(link?.textContent).toBe("upgrade guide");
  });
});
