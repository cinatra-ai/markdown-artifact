// Which sanitizer the test run resolved (see `vitest.config.ts`). The two
// suites that need one mode or the other read this and skip in the other, so a
// run never silently proves less than it claims.
//
// A SUPPLIED TREE IS ALWAYS REAL MODE: if `CINATRA_SDK_EXTENSIONS_DIR` is set,
// the config resolved the leaf through that package's own `exports` map or
// threw. There is no third state in which a real-mode run quietly used the
// double.

/** True when the REAL sanitizer leaf is what the displays imported. */
export const REAL_SANITIZER = Boolean(process.env.CINATRA_SDK_EXTENSIONS_DIR);
