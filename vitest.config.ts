import { existsSync, readFileSync } from "node:fs";
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

// THREE SPECIFIERS ARE HOST-PROVIDED, and they resolve the same two ways: the
// markdown sanitizer, the artifact-edit-channel's SAVE ROAD, and the
// application's TOAST SURFACE. A display may carry none of the three itself, so
// each is resolved through its package's own `exports` map in real mode and to
// an inert recording double in stub mode. The imports in `src/` are never
// rewritten for a test.
const SPECIFIER = "@cinatra-ai/sdk-extensions/markdown-sanitizer";
const SUBPATH = "./markdown-sanitizer";
const EDIT_SPECIFIER = "@cinatra-ai/sdk-extensions/artifact-edit-channel";
const EDIT_SUBPATH = "./artifact-edit-channel";
const TOAST_SPECIFIER = "@cinatra-ai/sdk-ui/toast";
const TOAST_SUBPATH = "./toast";

/** Resolve the leaf THROUGH THE SDK PACKAGE'S OWN `exports` MAP, never by
 * guessing an internal path: the specifier a host resolves is the one the SDK
 * publishes, so a real-mode run that reached a file the SDK does not publish
 * would prove the wrong thing. A supplied tree that does not publish the entry
 * is an error, not a silent fall back to the double. */
function realLeafFrom(dir: string, pkgName: string, subpath: string, specifier: string): string {
  const manifest = JSON.parse(readFileSync(`${dir}/package.json`, "utf8")) as {
    name?: string;
    exports?: Record<string, unknown>;
  };
  if (manifest.name !== pkgName) {
    throw new Error(
      `${dir} is "${manifest.name ?? "unnamed"}", not ${pkgName} — it cannot stand in for ${specifier}.`,
    );
  }
  const target = manifest.exports?.[subpath];
  if (typeof target !== "string") {
    throw new Error(`${dir} does not publish "${subpath}" — it cannot stand in for ${specifier}.`);
  }
  const resolved = `${dir}/${target.replace(/^\.\//, "")}`;
  if (!existsSync(resolved)) {
    throw new Error(`${dir} publishes "${subpath}" as ${target}, which does not exist.`);
  }
  return resolved;
}

function realSanitizerFrom(dir: string): string {
  return realLeafFrom(dir, "@cinatra-ai/sdk-extensions", SUBPATH, SPECIFIER);
}

const sdkDir = process.env.CINATRA_SDK_EXTENSIONS_DIR ?? "";
const sdkUiDir = process.env.CINATRA_SDK_UI_DIR ?? "";
const sanitizerTarget = sdkDir
  ? realSanitizerFrom(sdkDir)
  : fileURLToPath(new URL("./tests/stubs/markdown-sanitizer-stub.ts", import.meta.url));
const editChannelTarget = sdkDir
  ? realLeafFrom(sdkDir, "@cinatra-ai/sdk-extensions", EDIT_SUBPATH, EDIT_SPECIFIER)
  : fileURLToPath(new URL("./tests/stubs/artifact-edit-channel-stub.ts", import.meta.url));
const toastTarget = sdkUiDir
  ? realLeafFrom(sdkUiDir, "@cinatra-ai/sdk-ui", TOAST_SUBPATH, TOAST_SPECIFIER)
  : fileURLToPath(new URL("./tests/stubs/sdk-ui-toast-stub.ts", import.meta.url));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@cinatra-ai/sdk-extensions/markdown-sanitizer": sanitizerTarget,
      "@cinatra-ai/sdk-extensions/artifact-edit-channel": editChannelTarget,
      "@cinatra-ai/sdk-ui/toast": toastTarget,
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
