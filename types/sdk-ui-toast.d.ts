// The SHAPE of the SDK-UI toast surface, for this repository's own typecheck
// ONLY.
//
// The toast surface is host-provided — one `sonner` instance, mounted by the
// application, reached by every surface through `@cinatra-ai/sdk-ui/toast`. A
// display cannot mount a toaster of its own and must not draw a note of its own
// inside itself (the drawing: "the reason is a toast, never a note inside the
// display"), so it reports through this one. A standalone extension repository
// cannot resolve the SDK, so the specifier resolves to the real source when one
// is installed and to this declaration otherwise.

export interface CinatraToastLike {
  (message: string, options?: Record<string, unknown>): unknown;
  success(message: string, options?: Record<string, unknown>): unknown;
  error(message: string, options?: Record<string, unknown>): unknown;
  warning(message: string, options?: Record<string, unknown>): unknown;
  info(message: string, options?: Record<string, unknown>): unknown;
  message(message: string, options?: Record<string, unknown>): unknown;
}

export declare const cinatraToast: CinatraToastLike;
export declare const toast: CinatraToastLike;
