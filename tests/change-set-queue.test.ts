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
  const outcomes: string[] = [];
  let release: (() => void) | null = null;
  const queue = createChangeSetQueue<string>({
    idlePauseMs,
    save: (text) => {
      sent.push(text);
      return new Promise<string>((resolve) => {
        release = () => resolve(`saved:${text}`);
      });
    },
    onOutcome: (outcome) => outcomes.push(outcome),
  });
  return { queue, sent, outcomes, settle: async () => { release?.(); await Promise.resolve(); await Promise.resolve(); } };
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
