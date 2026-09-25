// THE CONFORMANCE ANCHORS OF THE TABBED DISPLAY (cinatra#3426, item 2).
//
// The ratified drawing's manifest declares the surface `markdown-display-tabs`
// with ONE field (`content` from `representation.markdown`), ONE action
// (`edit-markdown`, outcome `revision-saved`) and the states `error` and
// `loading`. The application's conformance driver addresses them on the
// display itself:
//
//   - the display:  `[data-conformance-id="markdown-display-tabs"]`
//   - the field:    ONE visible `[data-field="content=representation.markdown"]`
//                   inside the display
//   - the action:   the control `[data-action="edit-markdown -> revision-saved"]`
//   - a state:      `data-display-state` on the display
//
// This suite pins the display's half of that contract in a real DOM: the
// anchors sit on the real elements, the field binds exactly one element, the
// action exists only where the drawing offers an edit, and the state names the
// two readings of the drawing's own saving indicator the manifest declares —
// and nothing at any other moment. The floor and the compact preview are not
// this surface and carry none of it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import MarkdownArtifactPreview from "../src/renderers/preview";
import { ARTIFACT_EDIT_IDLE_PAUSE_MS } from "../src/artifact-edit-channel";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import {
  editSaveStub,
  gateNextSave,
  resetArtifactEditChannelStub,
} from "./stubs/artifact-edit-channel-stub";
import { resetToastStub } from "./stubs/sdk-ui-toast-stub";
import { resetMarkdownSanitizerStub } from "./stubs/markdown-sanitizer-stub";
import { props, textContent } from "./props-fixture";
import { REAL_SAVE_ROAD } from "./sanitizer-mode";

const SURFACE = '[data-conformance-id="markdown-display-tabs"]';
const FIELD = '[data-field="content=representation.markdown"]';
const ACTION_VALUE = "edit-markdown -> revision-saved";

/** The controls declaring the manifest's action. Read by VALUE rather than by
 *  an attribute-value selector: jsdom's selector engine does not match the
 *  `>` inside the quoted value the application's driver uses in a real
 *  browser, so the selector would read zero here whatever the DOM carries. */
function declaredActions(root: Element): Element[] {
  return [...root.querySelectorAll("[data-action]")].filter(
    (node) => node.getAttribute("data-action") === ACTION_VALUE,
  );
}

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

const REVIEW_TARGET: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 1,
  reason: "read-only-surface",
};

const NO_RIGHTS: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 1,
  reason: "no-write-rights",
};

function draw(edit: ArtifactEditCapability | undefined) {
  return render(<MarkdownArtifactDetail {...props(textContent(SOURCE), { edit })} />);
}

function display(): HTMLElement {
  const found = document.querySelectorAll(SURFACE);
  expect(found).toHaveLength(1);
  return found[0] as HTMLElement;
}

async function idle(ms = ARTIFACT_EDIT_IDLE_PAUSE_MS) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetArtifactEditChannelStub();
  resetToastStub();
  resetMarkdownSanitizerStub();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetArtifactEditChannelStub();
  resetToastStub();
  resetMarkdownSanitizerStub();
});

describe("the surface anchor", () => {
  it("names the tabbed display's root article as markdown-display-tabs", () => {
    draw(GRANT);
    const root = display();
    expect(root.tagName).toBe("ARTICLE");
    expect(root.getAttribute("data-artifact-renderer")).toBe("markdown");
    expect(root.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it("names it on a review target too — the same display, drawn read-only", () => {
    draw(REVIEW_TARGET);
    const root = display();
    expect(root.getAttribute("data-editable")).toBe("false");
  });

  it("carries no alert, no switch and no toggle group inside the display", () => {
    draw(GRANT);
    const root = display();
    expect(root.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(root.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(root.querySelectorAll('[data-slot="toggle-group"]')).toHaveLength(0);
  });
});

describe("the content field", () => {
  it("binds EXACTLY ONE element — the active tabpanel — on Code and on Preview", () => {
    draw(GRANT);
    let bound = display().querySelectorAll(FIELD);
    expect(bound).toHaveLength(1);
    expect(bound[0].getAttribute("role")).toBe("tabpanel");
    expect(bound[0].getAttribute("data-panel")).toBe("code");

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    bound = display().querySelectorAll(FIELD);
    expect(bound).toHaveLength(1);
    expect(bound[0].getAttribute("role")).toBe("tabpanel");
    expect(bound[0].getAttribute("data-panel")).toBe("preview");
  });

  it("binds the active panel on a review target, which opens on Preview", () => {
    draw(REVIEW_TARGET);
    const bound = display().querySelectorAll(FIELD);
    expect(bound).toHaveLength(1);
    expect(bound[0].getAttribute("data-panel")).toBe("preview");
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    const code = display().querySelectorAll(FIELD);
    expect(code).toHaveLength(1);
    expect(code[0].getAttribute("data-panel")).toBe("code");
  });
});

describe("the edit action", () => {
  it("is declared on the Code view's editable textarea under a granted edit", () => {
    draw(GRANT);
    const controls = declaredActions(display());
    expect(controls).toHaveLength(1);
    expect(controls[0]).toBe(screen.getByLabelText("Markdown source"));
    expect(display().querySelectorAll("[data-action]")).toHaveLength(1);
  });

  it("is declared NOWHERE on a read-only surface — the drawing offers no edit there", () => {
    for (const edit of [REVIEW_TARGET, NO_RIGHTS, undefined]) {
      const view = draw(edit);
      expect(display().querySelectorAll("[data-action]")).toHaveLength(0);
      fireEvent.click(screen.getByRole("tab", { name: "Code" }));
      expect(display().querySelectorAll("[data-action]")).toHaveLength(0);
      fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
      expect(display().querySelectorAll("[data-action]")).toHaveLength(0);
      view.unmount();
    }
  });
});

describe.skipIf(REAL_SAVE_ROAD)("the two states, read from the saving indicator", () => {
  it("carries NO state at rest — before the first edit there is nothing to say", () => {
    draw(GRANT);
    expect(display().hasAttribute("data-display-state")).toBe(false);
  });

  it("reads loading while a change set is in flight, and nothing once it is Saved", async () => {
    const release = gateNextSave();
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Edited\n" } });
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saving");
    expect(display().getAttribute("data-display-state")).toBe("loading");

    await idle();
    // Sent, parked on the gate: still in flight.
    expect(display().getAttribute("data-display-state")).toBe("loading");

    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saved");
    expect(display().hasAttribute("data-display-state")).toBe(false);
  });

  it("reads error when the indicator reads Not saved, and the reason stays a toast", async () => {
    editSaveStub.defaultOutcome = { outcome: "failed", reason: "transport" };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();
    await settle();
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("not-saved");
    expect(display().getAttribute("data-display-state")).toBe("error");
    expect(display().querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(display().textContent).not.toContain("could not be reached");
  });

  it("reads error after a stale refusal reloads the newer revision", async () => {
    editSaveStub.defaultOutcome = {
      outcome: "stale",
      latestRevisionId: "rev_9",
      latestRevision: 9,
      text: "# Somebody else's newer document\n",
      truncated: false,
    };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();
    expect(display().getAttribute("data-display-state")).toBe("error");
  });

  it("returns to loading at the next keystroke after an error", async () => {
    editSaveStub.outcomes = [{ outcome: "failed", reason: "transport" }];
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source");
    fireEvent.change(editor, { target: { value: "# One\n" } });
    await idle();
    expect(display().getAttribute("data-display-state")).toBe("error");
    fireEvent.change(editor, { target: { value: "# One two\n" } });
    expect(display().getAttribute("data-display-state")).toBe("loading");
  });
});

describe("read-only readings carry no state", () => {
  it("a review target, a refusal and a missing capability carry no data-display-state", () => {
    for (const edit of [REVIEW_TARGET, NO_RIGHTS, undefined]) {
      const view = draw(edit);
      expect(display().hasAttribute("data-display-state")).toBe(false);
      view.unmount();
    }
  });
});

describe("the floor and the compact preview are not this surface", () => {
  it("the floor carries no conformance id, no field, no action and no state", () => {
    render(
      <MarkdownArtifactDetail
        {...props(
          { kind: "none", channelVersion: 1, representationRevisionId: null, reason: "absent" },
          { edit: GRANT },
        )}
      />,
    );
    expect(document.querySelector("[data-floor]")).not.toBeNull();
    expect(document.querySelectorAll("[data-conformance-id]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-field]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-action]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-display-state]")).toHaveLength(0);
  });

  it("the compact preview carries no conformance id, no field, no action and no state", () => {
    render(<MarkdownArtifactPreview {...props(textContent(SOURCE), { edit: GRANT })} />);
    expect(document.querySelector("[data-compact='true']")).not.toBeNull();
    expect(document.querySelectorAll("[data-conformance-id]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-field]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-action]")).toHaveLength(0);
    expect(document.querySelectorAll("[data-display-state]")).toHaveLength(0);
  });
});
