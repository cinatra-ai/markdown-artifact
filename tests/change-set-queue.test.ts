// THE CHANGE SET AND ITS QUEUE — the timing and the serialisation, on a fake
// clock, without a DOM.
//
// "The save unit is a change set, sent after a short idle pause or on leaving
// the view, one revision per saved change set … saves in flight are serialised
// per editor."

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChangeSetQueue } from "../src/renderers/markdown-change-set-queue";

function harness(idlePauseMs = 900) {
  const sent: string[] = [];
  /** Whether each save was marked as one that must outlive its document. */
  const leaving: boolean[] = [];
  const outcomes: string[] = [];
  let release: (() => void) | null = null;
  const queue = createChangeSetQueue<string>({
    idlePauseMs,
    save: (text, options) => {
      sent.push(text);
      leaving.push(options.leaving);
      return new Promise<string>((resolve) => {
        release = () => resolve(`saved:${text}`);
      });
    },
    onOutcome: (outcome) => outcomes.push(outcome),
  });
  return { queue, sent, leaving, outcomes, settle: async () => { release?.(); await Promise.resolve(); await Promise.resolve(); } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the idle pause", () => {
  it("sends nothing until the pause has elapsed", () => {
    const h = harness();
    h.queue.edited("a");
    vi.advanceTimersByTime(899);
    expect(h.sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(h.sent).toEqual(["a"]);
  });

  it("COALESCES a burst of edits into ONE change set — the latest text", () => {
    const h = harness();
    h.queue.edited("a");
    vi.advanceTimersByTime(500);
    h.queue.edited("ab");
    vi.advanceTimersByTime(500);
    h.queue.edited("abc");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["abc"]);
  });
});

describe("leaving the view", () => {
  it("sends at once, without waiting for the pause", () => {
    const h = harness();
    h.queue.edited("a");
    h.queue.flush();
    expect(h.sent).toEqual(["a"]);
  });

  // A LEAVING FLUSH THAT HAD NOTHING TO SEND MARKS NOTHING LATER. The budget a
  // browser gives requests that outlive their document is small and SHARED
  // across every such request the page has in flight, so a mark spent on a save
  // that has a live document to complete in is a mark the leaving save may not
  // have. A page hidden with nothing unsent, then shown again, is not leaving:
  // the intent is remembered only where there is a change set it could not send.
  it("does not mark a LATER ordinary save when the leaving flush had nothing to send", () => {
    const h = harness();
    // Hidden with an empty slot, then visible again.
    h.queue.flush(true);
    expect(h.sent).toEqual([]);
    // An ordinary edit, sent by the pause under a live document.
    h.queue.edited("a");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["a"]);
    expect(h.leaving).toEqual([false]);
  });

  // And the intent IS kept where there was something it could not send.
  it("keeps the leaving mark for a change set the flush could not send yet", async () => {
    const h = harness();
    h.queue.edited("one");
    vi.advanceTimersByTime(900);
    expect(h.leaving).toEqual([false]);
    h.queue.edited("two");
    h.queue.flush(true);
    await h.settle();
    expect(h.sent).toEqual(["one", "two"]);
    expect(h.leaving).toEqual([false, true]);
  });

  // AND THE INTENT GOES WITH THE CHANGE SET IT BELONGED TO. A save refused as
  // stale reloads the newer revision and CANCELS the change set waiting behind
  // it — and the leaving mark that change set was carrying is cancelled with
  // it. A mark left latched here is spent on the very next ordinary save, one
  // that has a live document to complete in, out of a budget the real leaving
  // save may then not have.
  it("drops the leaving mark when the change set carrying it is CANCELLED", async () => {
    const h = harness();
    h.queue.edited("one");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one"]);
    // A second change set, and the page is hidden while "one" is still on the
    // wire: the mark is remembered because "two" could not be sent yet.
    h.queue.edited("two");
    h.queue.flush(true);
    expect(h.sent).toEqual(["one"]);
    // The stale reload drops "two" and puts the newer revision on screen.
    h.queue.cancelPending();
    await h.settle();
    expect(h.sent).toEqual(["one"]);
    // Back on a live document, the next change set is an ORDINARY save.
    h.queue.edited("three");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one", "three"]);
    expect(h.leaving).toEqual([false, false]);
  });

  it("sends nothing when nothing is unsent", () => {
    const h = harness();
    h.queue.flush();
    h.queue.flush();
    expect(h.sent).toEqual([]);
  });

  it("sends the last change set on dispose, and nothing after it", async () => {
    const h = harness();
    h.queue.edited("a");
    h.queue.dispose();
    expect(h.sent).toEqual(["a"]);
    h.queue.edited("b");
    vi.advanceTimersByTime(5000);
    expect(h.sent).toEqual(["a"]);
  });
});

describe("serialisation", () => {
  it("keeps ONE save in flight and coalesces what arrives meanwhile", async () => {
    const h = harness();
    h.queue.edited("one");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one"]);
    expect(h.queue.inFlight).toBe(true);

    h.queue.edited("two");
    vi.advanceTimersByTime(900);
    h.queue.edited("three");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one"]);

    await h.settle();
    expect(h.sent).toEqual(["one", "three"]);
    expect(h.outcomes).toEqual(["saved:one"]);
  });
});

describe("a refusal that reloads the editor", () => {
  it("FORGETS the change set waiting behind it, so it is never sent over the winner", async () => {
    const h = harness();
    h.queue.edited("mine");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["mine"]);
    expect(h.queue.inFlight).toBe(true);

    // Typed while that save was in flight — and belonging to the document the
    // refusal is about to replace.
    h.queue.edited("mine, with more");
    vi.advanceTimersByTime(900);
    expect(h.queue.pending).toBe(true);

    // The refusal reloads the editor onto the newer revision; what was waiting
    // describes a document nobody is looking at any more.
    h.queue.cancelPending();
    expect(h.queue.pending).toBe(false);

    await h.settle();
    expect(h.sent).toEqual(["mine"]);
  });
});

describe("leaving the view WHILE a save is in flight", () => {
  it("still sends the change set that was waiting — the last edit is not lost", async () => {
    const h = harness();
    h.queue.edited("one");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one"]);

    // The last thing the person typed, made while the first save was in flight.
    h.queue.edited("two");
    vi.advanceTimersByTime(900);
    expect(h.sent).toEqual(["one"]);

    // They navigate away.
    h.queue.dispose();
    await h.settle();
    expect(h.sent).toEqual(["one", "two"]);
  });

  it("and takes NOTHING new after it — the editor is closed to further edits", async () => {
    const h = harness();
    h.queue.edited("one");
    vi.advanceTimersByTime(900);
    h.queue.dispose();
    await h.settle();
    h.queue.edited("late");
    vi.advanceTimersByTime(5000);
    expect(h.sent).toEqual(["one"]);
  });
});
