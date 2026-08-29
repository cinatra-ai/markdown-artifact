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

/**
 * True when the REAL save road is what the editor imported.
 *
 * The SAME environment variable decides it, because the same package publishes
 * both leaves — but they are two different facts and the suites that depend on
 * them are different suites, so they are two names. The real save road posts to
 * the address on the capability; there is no host at that address in a unit run,
 * so the suites that pin what the editor DOES with an answer need the recording
 * double and say so by skipping here. What the real road does with a change set
 * is proved in the host's own suites, against a real database.
 */
export const REAL_SAVE_ROAD = Boolean(process.env.CINATRA_SDK_EXTENSIONS_DIR);
