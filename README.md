# Markdown

The system home for markdown documents in the Cinatra artifact library. It accepts `text/markdown` and files it under a dedicated markdown type, so a `.md` file you attach in chat, upload to the library or hand to an agent lands correctly typed as markdown rather than as general text — and it draws that document wherever it is shown.

Install from the Cinatra marketplace by searching for "Markdown" and clicking **Add**. No credentials or configuration are required; the type is active immediately for all workspace members.

There are two views. The full view draws the whole document on the artifact page: headings, emphasis, lists, tables, quotes, code blocks and code spans, links, and images from the web. The compact view draws the same document, clipped to fit beside other things — a review card, a representation viewer, a list of work. Both are read-only, and both show the document exactly as it was stored at the revision you are looking at; a document too large to show in full says so and tells you how much of it you are reading.

The document is drawn through the platform shared markdown sanitizer, so markup written inside a document is never markup in your page: raw html, scripts and event handlers are dropped, and a link or an image is drawn only when its destination uses a scheme the platform allows. When there is nothing to draw — no stored document yet, a document that is not markdown, an empty one — the view says which of those it is instead of showing you a blank panel.

## Works with

- Cinatra chat — attach a `.md` document directly in any thread
- The artifact library — every markdown document under one type
- Agents that write markdown — their drafts file here, and are reviewed in this view

## Capabilities

- Accept `text/markdown` uploads as a dedicated artifact type
- Give every markdown document one identity across chat, the library and a review
- Draw a markdown document in full, and the same document compact beside other work
- Render every document through the platform shared markdown sanitizer, never a second one
- Show the document at the revision being viewed, read-only, and say why when there is nothing to draw
- Declare and publish both views through the package own exports
