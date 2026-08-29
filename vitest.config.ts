import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// jsdom so the display entries can be mounted in a real DOM. The automatic JSX
// runtime matches the tsconfig `jsx: "react-jsx"`.
//
// THE SANITIZER SPECIFIER RESOLVES IN TWO MODES, and the displays import the
// SAME specifier in both — the import in `src/` is never rewritten for a test.
//
//   REAL MODE — `CINATRA_SDK_EXTENSIONS_DIR` points at the SDK package that
//   publishes the sanitizer leaf entry. The specifier resolves to the REAL
//   implementation, and `tests/sanitizer-conformance.test.tsx` pins, end to end,
//   every markdown construct the sanitizer admits and every one it strips. This
//   is the mode a host-side run uses.
//
//   STUB MODE — no SDK tree is supplied (a standalone repository install, which
//   is what this repository's own CI does). The specifier resolves to an inert
//   recording double, and the display-contract suite pins the half of the
//   contract this package owns: the pinned text goes to the sanitizer once, its
//   output is injected verbatim, and the document's own markdown reaches the DOM
//   by no other road. The suites that need the real sanitizer skip, loudly.
//
// A double is never a sanitizer, and this package must never carry a second
// sanitizer implementation — that is the whole reason the leaf entry exists.

const sdkDir = process.env.CINATRA_SDK_EXTENSIONS_DIR ?? "";
const realSanitizer = sdkDir ? `${sdkDir}/src/markdown-sanitizer.ts` : "";
const sanitizerTarget =
  realSanitizer && existsSync(realSanitizer)
    ? realSanitizer
    : fileURLToPath(new URL("./tests/stubs/markdown-sanitizer-stub.ts", import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@cinatra-ai/sdk-extensions/markdown-sanitizer": sanitizerTarget,
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
