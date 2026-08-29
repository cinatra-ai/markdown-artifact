// Which sanitizer the test run resolved (see `vitest.config.ts`). The two
// suites that need one mode or the other read this and skip in the other, so a
// run never silently proves less than it claims.

import { existsSync } from "node:fs";

const dir = process.env.CINATRA_SDK_EXTENSIONS_DIR ?? "";

/** True when the REAL sanitizer leaf is what the displays imported. */
export const REAL_SANITIZER = Boolean(dir) && existsSync(`${dir}/src/markdown-sanitizer.ts`);
