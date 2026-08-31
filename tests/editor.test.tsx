// THE MARKDOWN EDITOR — the display's own half of enabler 0.20, in a real DOM.
//
// ACCEPTANCE ITEM 1 lives here in the form this repository can prove it: the
// REAL display component, mounted in jsdom, asserting tabs labelled Code and
// Preview, exactly one panel on screen at a time, editable markdown in Code and
// rendered markdown in Preview. The same assertions run against the real page in
// the host's browser suite; nothing here is a stand-in for the display itself —
// the component under test IS the one the host mounts.
//
// The two doubles this suite uses are the HOST'S ROADS, not the display: the
// sanitizer (already doubled here for the same reason) and the save road. What a
// change set DOES is proved in the host's suites against a real database; what
// the display does with the answer is proved here.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import MarkdownArtifactDetail from "../src/renderers/detail";
import { ARTIFACT_EDIT_IDLE_PAUSE_MS } from "../src/artifact-edit-channel";
import type { ArtifactEditCapability } from "../src/artifact-edit-channel";
import {
  editSaveCalls,
  editSaveStub,
  gateNextSave,
  resetArtifactEditChannelStub,
} from "./stubs/artifact-edit-channel-stub";
import { resetToastStub, toastCalls } from "./stubs/sdk-ui-toast-stub";
import { resetMarkdownSanitizerStub, sanitizerCalls } from "./stubs/markdown-sanitizer-stub";
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

const REFUSED: ArtifactEditCapability = {
  kind: "read-only",
  channelVersion: 1,
  reason: "read-only-surface",
};

function draw(edit: ArtifactEditCapability, source = SOURCE) {
  return render(<MarkdownArtifactDetail {...props(textContent(source), { edit })} />);
}

/** Let the idle pause elapse and every queued promise settle. */
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
});

describe("the two tabs, and only one of them on screen", () => {
  it("draws tabs labelled Code and Preview, in a real tablist", () => {
    draw(GRANT);
    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Code", "Preview"]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].getAttribute("aria-selected")).toBe("false");
  });

  it("shows EXACTLY ONE panel at a time — never the two side by side", () => {
    draw(GRANT);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(document.querySelector("[data-panel='code']")).not.toBeNull();
    expect(document.querySelector("[data-panel='preview']")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(document.querySelector("[data-panel='code']")).toBeNull();
    expect(document.querySelector("[data-panel='preview']")).not.toBeNull();
  });

  it("puts the MARKDOWN, editable, in Code — and the RENDERED document in Preview", () => {
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source") as HTMLTextAreaElement;
    expect(editor.tagName).toBe("TEXTAREA");
    expect(editor.readOnly).toBe(false);
    expect(editor.value).toBe(SOURCE);
    // The markdown is drawn as markdown, with its own syntax visible.
    expect(document.querySelector("[data-token='heading']")?.textContent).toBe("# A heading");

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.queryByLabelText("Markdown source")).toBeNull();
    const body = document.querySelector("[data-markdown-body]");
    expect(body).not.toBeNull();
    // Rendered, not the markdown: a tag the document did not contain, and none
    // of its own syntax. The stub's marker is asserted only in stub mode — in
    // real mode the same body carries the real sanitizer's html, which the
    // conformance suite pins construct by construct.
    expect(body?.innerHTML).toContain("<");
    if (!REAL_SANITIZER) expect(body?.innerHTML).toContain("SANITIZED");
    // The document's own markdown never reaches the preview as text.
    expect(body?.textContent).not.toContain("**bold**");
    if (!REAL_SANITIZER) expect(sanitizerCalls.length).toBeGreaterThan(0);
  });

  it("moves between the tabs with the arrow keys, like every other tablist", () => {
    draw(GRANT);
    fireEvent.keyDown(screen.getByRole("tab", { name: "Code" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")).toBe("true");
  });

  it("carries NOTHING BESIDE THE TABS but the indicator — no renderer name, no package", () => {
    draw(GRANT);
    const header = screen.getByRole("tablist").parentElement as HTMLElement;
    expect(header.textContent).toBe("CodePreview");
    expect(header.textContent).not.toContain("markdown-artifact");
    expect(header.textContent).not.toContain("@cinatra-ai");
  });
});

describe("read-only, where the artifact is reviewed", () => {
  it("draws BOTH TABS, NEITHER EDITABLE, and no indicator to draw", () => {
    draw(REFUSED);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Code", "Preview"]);
    // A REVIEW CARD OPENS ON THE RENDERED DOCUMENT — the reviewer decides on the
    // work as it will be seen — and Code is one press away, not editable there
    // either.
    expect(screen.getByRole("tab", { name: "Preview" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByLabelText("Markdown source")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.queryByLabelText("Markdown source")).toBeNull();
    expect(document.querySelector("[data-code-readonly]")?.textContent).toBe(SOURCE);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("[data-editable='false']")).not.toBeNull();
    expect(document.querySelector("[data-read-only-reason='read-only-surface']")).not.toBeNull();
  });

  it.skipIf(REAL_SAVE_ROAD)("sends NOTHING, ever — there is no road from this surface to a write", async () => {
    draw(REFUSED);
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    await idle();
    expect(editSaveCalls).toHaveLength(0);
  });
});

describe.skipIf(REAL_SAVE_ROAD)("the spinner, and the check", () => {
  it("spins from the FIRST KEYSTROKE, before anything is sent", () => {
    draw(GRANT);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Edited\n" } });
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saving");
    expect(screen.getByRole("status").textContent).toContain("Saving");
    expect(editSaveCalls).toHaveLength(0);
  });

  it("sends ONE change set after the idle pause, and turns into a check", async () => {
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source");
    fireEvent.change(editor, { target: { value: "# One\n" } });
    fireEvent.change(editor, { target: { value: "# One two\n" } });
    fireEvent.change(editor, { target: { value: "# One two three\n" } });
    await idle();
    expect(editSaveCalls).toHaveLength(1);
    expect(editSaveCalls[0].text).toBe("# One two three\n");
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saved");
    expect(screen.getByRole("status").textContent).toContain("Saved");
  });

  it("checks an UNCHANGED save too — the document on screen is the one stored", async () => {
    // A person types and then takes it back: the change set that arrives equals
    // what is stored, the host writes nothing, and the indicator still settles
    // on the check, because the document on screen IS the document stored.
    editSaveStub.defaultOutcome = { outcome: "unchanged", revisionId: "rev_1" };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: `${SOURCE}x` } });
    await idle();
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saved");
    expect(toastCalls).toHaveLength(0);
  });
});

describe.skipIf(REAL_SAVE_ROAD)("the change set's boundaries", () => {
  it("sends on LEAVING THE VIEW, before the pause has elapsed", async () => {
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Left\n" } });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    await settle();
    expect(editSaveCalls).toHaveLength(1);
    expect(editSaveCalls[0].text).toBe("# Left\n");
  });

  it("sends on BLUR, and once the document is hidden", async () => {
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source");
    fireEvent.change(editor, { target: { value: "# Blurred\n" } });
    fireEvent.blur(editor);
    await settle();
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# Blurred\n"]);

    fireEvent.change(editor, { target: { value: "# Hidden\n" } });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    await settle();
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# Blurred\n", "# Hidden\n"]);
  });

  it("SERIALISES: one save in flight, the next carrying only the latest text", async () => {
    const release = gateNextSave();
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source");

    fireEvent.change(editor, { target: { value: "# First\n" } });
    await idle();
    expect(editSaveCalls).toHaveLength(1);

    // Two more change sets while the first save is still in flight.
    fireEvent.change(editor, { target: { value: "# Second\n" } });
    await idle();
    fireEvent.change(editor, { target: { value: "# Third\n" } });
    await idle();
    expect(editSaveCalls).toHaveLength(1);

    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# First\n", "# Third\n"]);
  });

  it("names the revision the editor is on as the base, and moves it after a save", async () => {
    editSaveStub.outcomes = [
      { outcome: "saved", revisionId: "rev_2", revision: 2 },
      { outcome: "saved", revisionId: "rev_3", revision: 3 },
    ];
    draw(GRANT);
    const editor = screen.getByLabelText("Markdown source");
    fireEvent.change(editor, { target: { value: "# Two\n" } });
    await idle();
    fireEvent.change(editor, { target: { value: "# Three\n" } });
    await idle();
    expect(
      editSaveCalls.map((c) => (c.capability as { baseRevisionId: string }).baseRevisionId),
    ).toEqual(["rev_1", "rev_2"]);
  });
});

describe.skipIf(REAL_SAVE_ROAD)("a save that did not go through", () => {
  it("REFUSES a stale save, RELOADS the newer revision, and says why in a toast", async () => {
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

    const editor = screen.getByLabelText("Markdown source") as HTMLTextAreaElement;
    expect(editor.value).toBe("# Somebody else's newer document\n");
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("not-saved");
    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0].variant).toBe("warning");
    expect(toastCalls[0].message).toContain("moved to a newer revision");
    // The reason is a TOAST, never a note inside the display.
    expect(document.querySelector("[data-artifact-renderer='markdown']")?.textContent).not.toContain(
      "moved to a newer revision",
    );
  });

  /**
   * THE ROOT'S REVISION AND THE TEXT IN THE VIEW ARE ONE READING.
   *
   * "The editor RELOADS onto the newer revision." The reload replaced the text,
   * the base the next change set is built on, and the indicator — but the
   * display root kept writing the revision the page was OPENED on, so the
   * attribute named one revision while the code area held another's text. A
   * reader of the DOM (a browser test, a screenshot, the person's own inspector)
   * was told the wrong thing about what was on screen.
   */
  it("MOVES THE ROOT'S REVISION with the reload — the attribute and the text agree", async () => {
    editSaveStub.defaultOutcome = {
      outcome: "stale",
      latestRevisionId: "rev_9",
      latestRevision: 9,
      text: "# Somebody else's newer document\n",
      truncated: false,
    };
    draw(GRANT);
    const root = () => document.querySelector("[data-artifact-renderer='markdown']");
    // Before the refusal it names the revision the page opened on.
    expect(root()?.getAttribute("data-revision")).toBe("rev_1");

    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();

    expect((screen.getByLabelText("Markdown source") as HTMLTextAreaElement).value).toBe(
      "# Somebody else's newer document\n",
    );
    expect(root()?.getAttribute("data-revision")).toBe("rev_9");
  });

  it("leaves the root's revision ALONE when a save merely failed — nothing was reloaded", async () => {
    editSaveStub.defaultOutcome = { outcome: "failed", reason: "transport" };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();
    expect(
      document.querySelector("[data-artifact-renderer='markdown']")?.getAttribute("data-revision"),
    ).toBe("rev_1");
  });

  it("KEEPS THE SPINNER and says why when the store could not be reached", async () => {
    editSaveStub.defaultOutcome = { outcome: "failed", reason: "transport" };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();
    const status = screen.getByRole("status");
    expect(status.getAttribute("data-saving-indicator")).toBe("not-saved");
    expect(status.textContent).toContain("Not saved");
    // The person's own text is NOT thrown away by a failed save.
    expect((screen.getByLabelText("Markdown source") as HTMLTextAreaElement).value).toBe("# Mine\n");
    expect(toastCalls[0]).toMatchObject({ variant: "error" });
    expect(toastCalls[0].message).toContain("could not be reached");
  });

  it("says why a refused save was refused, in the refusal's own words", async () => {
    editSaveStub.defaultOutcome = { outcome: "refused", reason: "no-write-rights" };
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# Mine\n" } });
    await idle();
    expect(toastCalls[0].message).toContain("do not have rights");
  });
});

describe("what happens to a change set made WHILE a save is in flight", () => {
  it("a STALE refusal drops it, so the reloaded revision is never written over", async () => {
    // The save that will be refused parks until the test releases it.
    const release = gateNextSave();
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
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# Mine\n"]);

    // Typed while that save was in flight, and belonging to the document the
    // refusal is about to replace.
    fireEvent.change(screen.getByLabelText("Markdown source"), {
      target: { value: "# Mine, with more\n" },
    });
    await idle();

    release();
    await settle();
    await idle();

    // The editor shows the newer revision…
    expect((screen.getByLabelText("Markdown source") as HTMLTextAreaElement).value).toBe(
      "# Somebody else's newer document\n",
    );
    // …and NOTHING was sent after the refusal: what was waiting would have been
    // saved over the very revision the refusal protected.
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# Mine\n"]);
  });

  it("the CHECK waits for the change the person can see, not for an older one", async () => {
    const releaseFirst = gateNextSave();
    draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# A\n" } });
    await idle();
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# A\n"]);

    // Typed while the first save was in flight: the document on screen is no
    // longer the document being stored.
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# A B\n" } });
    await idle();

    // The second save parks too, so the moment between them is observable.
    const releaseSecond = gateNextSave();
    releaseFirst();
    await settle();
    await idle();

    expect(editSaveCalls.map((c) => c.text)).toEqual(["# A\n", "# A B\n"]);
    // The older save stored an older document: the spinner stays.
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saving");

    releaseSecond();
    await settle();
    expect(screen.getByRole("status").getAttribute("data-saving-indicator")).toBe("saved");
  });

  it("LEAVING THE VIEW with a save in flight still saves the last change set", async () => {
    const release = gateNextSave();
    const view = draw(GRANT);
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# A\n" } });
    await idle();
    fireEvent.change(screen.getByLabelText("Markdown source"), { target: { value: "# A B\n" } });
    await idle();
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# A\n"]);

    // They navigate away with the last edit still waiting behind the save in
    // flight. Dropping it here is how an edit made in the last second disappears.
    view.unmount();
    release();
    await settle();
    await idle();
    expect(editSaveCalls.map((c) => c.text)).toEqual(["# A\n", "# A B\n"]);
  });
});
