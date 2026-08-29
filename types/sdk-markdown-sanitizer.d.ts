// The SHAPE of the SDK's markdown sanitizer leaf entry, for this repository's
// own typecheck ONLY.
//
// The sanitizer is host-provided: the host resolves
// `@cinatra-ai/sdk-extensions/markdown-sanitizer` when it builds this display,
// and a standalone extension repository cannot resolve the SDK at all. So the
// repository's tsconfig resolves that specifier to the real SDK source when one
// is installed and, when none is, to this declaration — the signature and
// nothing else. There is no implementation here and there must never be one:
// the whole point of the leaf entry is that the fleet has exactly ONE markdown
// sanitizer.

export declare const ALLOWED_MARKDOWN_URL_SCHEMES: ReadonlySet<string>;

export declare function isSafeMarkdownUrl(rawUrl: string): boolean;

export interface SanitizeMarkdownOptions {
  /** Demote every heading one level for a surface that owns its own top
   * heading. The sanitization boundary is identical on both paths. */
  demoteHeadings?: boolean;
}

/**
 * Render untrusted markdown as safe html. Blank input renders the empty string.
 * The result is html, injected by the caller inside a constrained container;
 * nothing downstream re-sanitizes.
 */
export declare function renderSanitizedMarkdown(
  markdown: string | null | undefined,
  options?: SanitizeMarkdownOptions,
): string;
