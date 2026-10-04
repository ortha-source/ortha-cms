import type { DrizzleKitRun } from './run-drizzle-kit';

/** What a drizzle-kit run amounted to. */
export type DrizzleKitOutcome =
    | 'generated'
    | 'unchanged'
    | 'ambiguous'
    | 'failed';

/**
 * Its question about a rename, refused for want of a TTY. Pinned against the
 * locked drizzle-kit by the generator's integration spec, so a version that
 * rewords it fails a test instead of reading as success.
 */
const PROMPT = /Interactive prompts require a TTY|created or renamed/i;
const NOTHING = /No schema changes, nothing to migrate/;

/**
 * The outcome, read from what the run **wrote** rather than how it exited:
 * drizzle-kit 0.31 exits 0 on a refused prompt and on a schema that does not
 * compile alike, so a zero exit proves nothing.
 */
export function readOutcome(
    run: DrizzleKitRun,
    newSqlFiles: number
): DrizzleKitOutcome {
    if (newSqlFiles > 0) return 'generated';
    if (PROMPT.test(run.output)) return 'ambiguous';
    if (!run.timedOut && NOTHING.test(run.output)) return 'unchanged';
    return 'failed';
}
