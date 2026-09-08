// A RECORDING DOUBLE for the host's toast surface, used ONLY by this package's
// own test run when the SDK-UI tree is not resolvable.
//
// IT SHOWS NOTHING. It records the variant and the sentence, which is exactly
// what the display's half of the contract is: WHICH sentence is reported, and
// THAT it is reported through the toast surface rather than drawn inside the
// display. What a toast looks like is the application's, and is pinned in the
// application's own specification.

export interface RecordedToast {
  variant: "message" | "success" | "error" | "warning" | "info";
  message: string;
}

export const toastCalls: RecordedToast[] = [];

export function resetToastStub(): void {
  toastCalls.length = 0;
}

function record(variant: RecordedToast["variant"]) {
  return (message: string): void => {
    toastCalls.push({ variant, message });
  };
}

export const cinatraToast = Object.assign(record("message"), {
  success: record("success"),
  error: record("error"),
  warning: record("warning"),
  info: record("info"),
  message: record("message"),
});

export const toast = cinatraToast;
