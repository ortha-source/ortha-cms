/**
 * Checks `global-setup` makes **before** it starts a container or touches a
 * database. Each one turns a failure that would otherwise present as a wall of
 * unrelated test failures into a single sentence naming the cause.
 *
 * Kept out of `global-setup.ts` so they can be exercised directly by
 * `harness-preflight.spec.ts` — a guard nothing tests is a guard that quietly
 * stops working.
 */

/**
 * Refuse to run with more than one Jest worker.
 *
 * `jest.config.cts` pins `maxWorkers: 1` and that setting is **load-bearing**:
 * every suite shares one Postgres testcontainer and `resetDb()` TRUNCATEs it
 * between tests. A CLI `--maxWorkers` / `-w` flag overrides the config, and the
 * result is not an error — it is suites truncating and seeding each other's
 * rows, surfacing as unique-constraint violations and off-by-N counts inside
 * tests that have nothing to do with the cause. That reads exactly like a
 * product regression, which is the worst possible failure mode for the only
 * gate this repo has.
 *
 * So: fail fast, and say why. Set `E2E_ALLOW_PARALLEL=true` only if you have
 * actually implemented the database-per-worker scheme.
 */
export function assertSerialExecution(maxWorkers: number | undefined): void {
    if (maxWorkers === undefined) return;
    if (maxWorkers <= 1) return;
    if (process.env['E2E_ALLOW_PARALLEL'] === 'true') return;

    throw new Error(
        `[e2e] Refusing to run with maxWorkers=${maxWorkers}.\n\n` +
            'apps/server-e2e shares ONE Postgres testcontainer across every suite, and\n' +
            '`resetDb()` TRUNCATEs it between tests. With more than one worker the suites\n' +
            "truncate and seed each other's rows, and the run fails with unique-constraint\n" +
            'violations and count mismatches inside tests that have nothing to do with the\n' +
            'cause — indistinguishable, at a glance, from a real regression.\n\n' +
            '`jest.config.cts` pins `maxWorkers: 1` for exactly this reason; a CLI\n' +
            '`--maxWorkers` / `-w` flag silently overrides it, which is why this check exists.\n\n' +
            'Parallelism needs a database-per-worker scheme first (apps/server-e2e/AGENTS.md).\n' +
            'Override with E2E_ALLOW_PARALLEL=true only once that exists.'
    );
}

/** The database name from a Postgres connection string, or `''`. */
function databaseName(connectionString: string): string {
    try {
        return new URL(connectionString).pathname.replace(/^\//, '');
    } catch {
        return '';
    }
}

/** Compare two connection strings ignoring trailing slashes / query order. */
function sameTarget(a: string, b: string): boolean {
    const normalise = (value: string) => value.trim().replace(/\/+$/, '');
    if (normalise(a) === normalise(b)) return true;
    try {
        const left = new URL(a);
        const right = new URL(b);
        return (
            left.host === right.host &&
            left.pathname.replace(/\/+$/, '') ===
                right.pathname.replace(/\/+$/, '')
        );
    } catch {
        return false;
    }
}

/** A name a human plausibly meant to be disposable. */
const DISPOSABLE_NAME = /(^|[_-])(e2e|test)([_-]|\d*$)/i;

/**
 * Refuse an `E2E_DATABASE_URL` that does not look disposable.
 *
 * The suite TRUNCATEs every mutable table in every `beforeEach`. Pointing it at
 * a working database destroys that database's contents, silently and in
 * seconds. Two cheap guards close the realistic accidents:
 *
 * 1. It must not name the same database as `DATABASE_URL` — the variable a
 *    developer's `.env` sets, which is the one thing they would lose.
 * 2. Its database name must read as disposable (`…e2e…` / `…test…`).
 *
 * `E2E_ALLOW_UNSAFE_DATABASE=true` waives (2) for a CI runner with an
 * oddly-named scratch database. Nothing waives (1).
 */
export function assertDisposableExternalDatabase(
    externalUrl: string,
    workingUrl: string | undefined
): void {
    if (workingUrl && sameTarget(externalUrl, workingUrl)) {
        throw new Error(
            '[e2e] Refusing to run: E2E_DATABASE_URL names the same database as DATABASE_URL.\n\n' +
                `  database: ${databaseName(externalUrl) || externalUrl}\n\n` +
                'This suite TRUNCATEs every mutable table before every test. DATABASE_URL is\n' +
                "the working database your `.env` points at — running here would empty it.\n\n" +
                'Point E2E_DATABASE_URL at a throwaway database, or unset it to use the\n' +
                'Postgres testcontainer (the default).'
        );
    }

    const name = databaseName(externalUrl);
    if (
        !DISPOSABLE_NAME.test(name) &&
        process.env['E2E_ALLOW_UNSAFE_DATABASE'] !== 'true'
    ) {
        throw new Error(
            `[e2e] Refusing to run: E2E_DATABASE_URL names "${name || externalUrl}", which does not look disposable.\n\n` +
                'This suite TRUNCATEs every mutable table before every test, so the database it\n' +
                'names must be one you are happy to lose. Name it with `e2e` or `test` in it\n' +
                '(e.g. `ortha_e2e`), or set E2E_ALLOW_UNSAFE_DATABASE=true if you are certain.'
        );
    }
}
