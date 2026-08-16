import { resetCopilot } from './copilot';

/**
 * Per-test harness state that is not in the database, and so is not reached by
 * `resetDb`.
 *
 * Registered through `setupFilesAfterEnv`, which runs inside each spec file's
 * own module registry — so this is per-file state being reset per test, not
 * anything shared across files.
 */
afterEach(() => {
    // The scripted model provider. See `resetCopilot` for why inheriting a
    // previous test's script is worse than failing.
    resetCopilot();
});
