// The one reason both markdown displays refuse to draw, in one place so the
// detail entry, the preview entry and their tests cannot drift apart.
//
// TODO: replace this refusal with the real rendering once the markdown
// sanitizer leaf entry of `@cinatra-ai/sdk-ui` is published. That leaf is the
// only sanitizer surface an extension may depend on, and it does not exist yet;
// until it does, drawing markdown here would mean shipping a second, unreviewed
// sanitizer inside this package, which is exactly what the leaf exists to
// prevent. Both entries import the leaf and render through it; nothing else in
// this package changes.

export const MARKDOWN_DISPLAY_UNAVAILABLE =
  "This markdown display is declared but cannot draw yet: it renders through the " +
  "SDK's markdown sanitizer leaf entry, which is not published. Until that entry " +
  "exists this display refuses rather than rendering markdown through an " +
  "unsanctioned sanitizer of its own.";
