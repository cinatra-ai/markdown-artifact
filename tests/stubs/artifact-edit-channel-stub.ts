// A RECORDING DOUBLE for the SDK's artifact-edit-channel leaf entry, used ONLY
// by this package's own test run when the SDK tree is not resolvable (an
// extension repository resolves standalone; the save road is host-provided).
//
// IT SAVES NOTHING, DELIBERATELY. It records the change set it was handed and
// answers with whatever outcome the test queued. What the tests using it pin is
// the DISPLAY's half of the contract — that one change set is sent per idle
// pause, that two are never in flight at once, that the indicator reads from the
// outcome and from nothing else, and that a refused save reloads rather than
// overwrites. What the host DOES with a change set is proved in the host's own
// suites, against a real database.

export interface RecordedEditSave {
  capability: unknown;
  text: string;
}

/** Every save the display sent, in order. */
export const editSaveCalls: RecordedEditSave[] = [];

/** What the next save answers with, and how long it takes to answer. */
export const editSaveStub: {
  outcomes: unknown[];
  defaultOutcome: unknown;
  /** When set, a save parks on this promise until the test resolves it — which
   *  is how "two saves are never in flight at once" becomes observable. */
  gate: null | { promise: Promise<void>; release: () => void };
} = {
  outcomes: [],
  defaultOutcome: { outcome: "saved", revisionId: "rev_2", revision: 2 },
  gate: null,
};

export function resetArtifactEditChannelStub(): void {
  editSaveCalls.length = 0;
  editSaveStub.outcomes = [];
  editSaveStub.defaultOutcome = { outcome: "saved", revisionId: "rev_2", revision: 2 };
  editSaveStub.gate = null;
}

/** Open a gate the next save will park on, with the handle to release it. */
export function gateNextSave(): () => void {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = () => resolve();
  });
  editSaveStub.gate = { promise, release };
  return release;
}

export async function saveArtifactEdit(
  capability: unknown,
  text: string,
): Promise<unknown> {
  editSaveCalls.push({ capability, text });
  const gate = editSaveStub.gate;
  if (gate) {
    editSaveStub.gate = null;
    await gate.promise;
  }
  return editSaveStub.outcomes.length > 0
    ? editSaveStub.outcomes.shift()
    : editSaveStub.defaultOutcome;
}

const SENTENCES: Record<string, string> = {
  stale: "This artifact moved to a newer revision while you were editing, so the save was refused rather than written over it. The newer revision is loaded here.",
  refused: "This change has not been saved.",
  failed: "This change has not been saved — the store could not be reached.",
};

export function artifactEditMessage(outcome: unknown): string | null {
  const o = (outcome ?? {}) as { outcome?: string };
  if (o.outcome === "saved" || o.outcome === "unchanged") return null;
  return SENTENCES[o.outcome ?? ""] ?? SENTENCES.failed;
}
