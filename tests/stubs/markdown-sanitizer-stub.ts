// A RECORDING DOUBLE for the SDK's markdown sanitizer leaf entry, used ONLY by
// this package's own test run when the SDK tree is not resolvable (an extension
// repository resolves standalone; the sanitizer is host-provided).
//
// IT IS NOT A SANITIZER, DELIBERATELY. It renders no markdown and strips
// nothing: it records the call and returns a marker. What the tests using it
// pin is the DISPLAY's half of the contract — that the display hands the pinned
// text to the sanitizer once, injects exactly what the sanitizer returned, and
// never puts the document's own markdown into the page by any other road.
//
// What the sanitizer ADMITS and STRIPS is pinned against the REAL leaf by
// `tests/sanitizer-conformance.test.tsx`, which runs when the SDK tree is
// supplied (`CINATRA_SDK_EXTENSIONS_DIR`). A second sanitizer implementation is
// exactly what this package must not carry, so the double stays inert.
//
// The ONE behaviour mirrored from the leaf is its blank-input contract: null,
// undefined or blank markdown renders the empty string.

export interface RecordedSanitizerCall {
  markdown: string | null | undefined;
  options?: { demoteHeadings?: boolean };
}

/** Every call the display made, in order. */
export const sanitizerCalls: RecordedSanitizerCall[] = [];

/** The marker the double returns for non-blank input. A test may replace it to
 * prove the display injects the sanitizer's OUTPUT rather than its input. */
export const sanitizerStubState = {
  html: '<p data-stub-sanitized="1">SANITIZED</p>',
};

export function resetMarkdownSanitizerStub(): void {
  sanitizerCalls.length = 0;
  sanitizerStubState.html = '<p data-stub-sanitized="1">SANITIZED</p>';
}

export function renderSanitizedMarkdown(
  markdown: string | null | undefined,
  options?: { demoteHeadings?: boolean },
): string {
  sanitizerCalls.push({ markdown, options });
  if (!markdown || markdown.trim().length === 0) return "";
  return sanitizerStubState.html;
}
