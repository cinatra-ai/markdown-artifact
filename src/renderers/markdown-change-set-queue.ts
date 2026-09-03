// THE CHANGE SET, AND THE QUEUE THAT KEEPS ONE SAVE IN FLIGHT.
//
// THE PLAN'S SENTENCES THIS MODULE OWNS: "The save unit is a CHANGE SET, sent
// after a SHORT IDLE PAUSE or ON LEAVING THE VIEW, one revision per saved change
// set … SAVES IN FLIGHT ARE SERIALISED PER EDITOR."
//
// WHAT A CHANGE SET IS. Not a keystroke and not a patch: the document as the
// editor holds it when the person stops typing for the pause, or when they leave
// the view before the pause elapses. One change set is one save is one revision,
// which is why the pause matters — without it a paragraph would be forty
// revisions of a document nobody wants forty revisions of.
//
// WHY A QUEUE AND NOT A LOCK. Two saves in flight at once on one document is the
// lost-update bug the expected base exists to refuse; letting the editor produce
// that situation and then be refused by the store would be a spinner that
// flickers red for no reason the person can act on. So the editor sends one save
// at a time and, while one is in flight, keeps only the LATEST text — an
// intermediate state that was superseded before it was ever sent is not work
// anybody needs a revision of. Coalescing is the point: the queue is one slot
// deep, never a backlog.
//
// (The host holds a lock of its own around the append. Neither is sufficient
// alone: this queue cannot see another PERSON's editor, and the host's lock
// cannot stop ONE editor from sending two change sets out of order.)
//
// FRAMEWORK-FREE ON PURPOSE. No React, no DOM: the timing and the serialisation
// are the parts most easily got wrong and most easily proved, so they live where
// a test can drive them with a fake clock.

export interface ChangeSetQueueDeps<TOutcome> {
  /** Send one change set. Never throws — the SDK's save answers with outcomes.
   *
   *  `leaving` says the reader is going: the pause never elapsed, the view or
   *  the document is on its way out, and the request has to outlive the document
   *  that started it if it is to complete at all. It is the queue that knows
   *  this — the send road only carries it. */
  save(text: string, options: { leaving: boolean }): Promise<TOutcome>;
  /** Called with every outcome, and the text that produced it. */
  onOutcome(outcome: TOutcome, text: string): void;
  /** Called when a change set is handed to `save`, so the indicator can spin. */
  onSending?(text: string): void;
  /** The idle pause, in milliseconds. */
  idlePauseMs: number;
}

export interface ChangeSetQueue {
  /** The document changed. Restarts the idle pause. */
  edited(text: string): void;
  /** Send NOW, if anything is unsent — leaving the view, or the pause elapsing.
   *  `leaving` is true where the DOCUMENT is going away (hidden, unloading,
   *  unmounting) and false where only the view changed under a live page. */
  flush(leaving?: boolean): void;
  /**
   * FORGET WHAT HAS NOT BEEN SENT. The editor reloaded onto another revision —
   * a stale refusal — so the text waiting in the slot describes a document that
   * is no longer on screen. Sending it would save what nobody is looking at over
   * the revision the person was just shown, which is the overwrite the expected
   * base exists to refuse. The next change set is whatever they type NEXT.
   */
  cancelPending(): void;
  /** Leaving for good: flush, then stop the clock. */
  dispose(): void;
  /** Test/diagnostic seam: is a save in flight right now? */
  readonly inFlight: boolean;
  /** Test/diagnostic seam: is there text waiting to be sent? */
  readonly pending: boolean;
}

export function createChangeSetQueue<TOutcome>(
  deps: ChangeSetQueueDeps<TOutcome>,
): ChangeSetQueue {
  /** The newest text that has not been handed to `save` yet. */
  let unsent: string | null = null;
  /** The text of the save currently in flight, or null. */
  let sending: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** Closed to NEW edits (the editor went away). Not closed to the LAST one. */
  let closed = false;
  /**
   * A FLUSH ASKED TO LEAVE AND COULD NOT SEND YET. The reader left while a save
   * was still on the wire, so the change set behind it had to wait — and it is
   * the one MOST likely to be lost, because by the time the slot frees the
   * document may already be gone. The intent is therefore remembered rather than
   * dropped with the call that could not act on it, and it only ever turns ON:
   * a page that is going away does not come back before the queue is finished.
   */
  let leavingPending = false;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const send = (leaving: boolean): void => {
    // NOTE the absence of a `closed` guard: a change set already made is sent
    // even if the editor has gone away. See `dispose`.
    if (sending !== null || unsent === null) {
      // THE INTENT IS REMEMBERED ONLY WHERE THERE IS A CHANGE SET IT COULD NOT
      // SEND. A flush that found the slot empty leaves nothing behind: the
      // budget a browser gives requests that outlive their document is small
      // and SHARED across every such request the page has in flight, so a mark
      // spent on a save that has a live document to complete in is a mark the
      // real leaving save may not have. A page hidden with an empty slot and
      // then shown again is not leaving, and the ordinary save that follows it
      // must not be marked as though it were.
      if (leaving && unsent !== null) leavingPending = true;
      return;
    }
    const text = unsent;
    unsent = null;
    sending = text;
    const leavingNow = leaving || leavingPending;
    leavingPending = false;
    deps.onSending?.(text);
    void deps.save(text, { leaving: leavingNow }).then(
      (outcome) => {
        sending = null;
        deps.onOutcome(outcome, text);
        // Anything typed while that save was in flight is the next change set,
        // and it goes at once: the person has stopped typing long enough for the
        // pause to fire, so waiting a second pause would be a delay they did
        // not ask for.
        // A change set queued behind this one is leaving too if the editor has
        // already gone away, or if a flush asked to leave while this save held
        // the slot — `closed` and `leavingPending` are those two facts.
        if (unsent !== null) send(closed || leavingPending);
      },
      () => {
        // `save` is the SDK's, which answers with outcomes rather than throwing.
        // A rejection here is a broken host road, not a failed save: release the
        // slot so the editor is not wedged, and let the next change set try.
        sending = null;
        if (unsent !== null) send(closed || leavingPending);
      },
    );
  };

  return {
    edited(text: string): void {
      if (closed) return;
      unsent = text;
      clear();
      timer = setTimeout(() => {
        timer = null;
        send(false);
      }, deps.idlePauseMs);
    },
    flush(leaving = false): void {
      clear();
      send(leaving);
    },
    cancelPending(): void {
      clear();
      unsent = null;
      // THE LEAVING MARK BELONGED TO THE CHANGE SET, and the change set is
      // gone. A refusal that reloads the newer revision drops the queued text;
      // a mark left latched here would be spent on the next ORDINARY save, one
      // that has a live document to complete in, out of a budget the real
      // leaving save may then not have.
      leavingPending = false;
    },
    /**
     * LEAVING FOR GOOD, WITHOUT LOSING THE LAST CHANGE SET. Closing to new edits
     * and stopping the clock is immediate; the text already in the slot is not
     * dropped. If a save is in flight the slot cannot be sent yet, so it goes the
     * moment that save settles — the same road every other queued change set
     * takes. Dropping it here is how an edit made in the last second before
     * navigating away disappears.
     */
    dispose(): void {
      clear();
      closed = true;
      send(true);
    },
    get inFlight(): boolean {
      return sending !== null;
    },
    get pending(): boolean {
      return unsent !== null;
    },
  };
}
