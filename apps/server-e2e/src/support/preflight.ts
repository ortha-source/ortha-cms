import { readFileSync } from 'node:fs';
import { freemem } from 'node:os';

/**
 * Checks `global-setup` makes **before** it starts a container or touches a
 * database. Each one turns a failure that would otherwise present as a wall of
 * unrelated test failures into a single sentence naming the cause.
 *
 * Kept out of `global-setup.ts` so they can be exercised directly by
 * `src/harness/harness-guards.spec.ts` — a guard nothing tests is a guard that
 * quietly stops working.
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

/**
 * Headroom a full run wants, in bytes.
 *
 * The worker's RSS climbs across the run (70+ files, each booting its own Nest
 * app), and Postgres, Docker and the container want their share beside it. Below
 * roughly this, the back half of the run starves — 30-second hook timeouts
 * first, then pool failures, then the container going away.
 */
const RECOMMENDED_FREE_BYTES = 2.5 * 1024 * 1024 * 1024;

/**
 * Memory a process could actually get, in bytes.
 *
 * `os.freemem()` is the wrong number on Linux: it reports `MemFree`, which
 * excludes reclaimable page cache, so a perfectly healthy box reads as nearly
 * out of memory (measured here: 204 MB "free" against 1.5 GB available). Prefer
 * `MemAvailable` from `/proc/meminfo`, which is the kernel's own estimate, and
 * fall back to `os.freemem()` where that file does not exist.
 */
export function availableMemoryBytes(): number {
    try {
        const meminfo = readFileSync('/proc/meminfo', 'utf8');
        const match = /^MemAvailable:\s+(\d+) kB$/m.exec(meminfo);
        if (match) return Number(match[1]) * 1024;
    } catch {
        // Not Linux, or /proc is not mounted — fall through.
    }
    return freemem();
}

/**
 * Warn — do not refuse — when the machine is short of memory.
 *
 * A warning rather than a hard failure because the threshold is a heuristic and
 * a targeted single-suite run needs far less. What matters is that the *first*
 * line of a starved run says memory, so the ~650 failures that follow are read
 * as one cause rather than 650 regressions. Returns the message it printed, or
 * `undefined`, so a test can assert the boundary.
 */
export function warnOnLowMemory(availableBytes: number): string | undefined {
    if (availableBytes >= RECOMMENDED_FREE_BYTES) return undefined;
    const gib = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GiB`;
    const message =
        `[e2e] WARNING: only ${gib(availableBytes)} of memory is available; a full run wants about ${gib(RECOMMENDED_FREE_BYTES)}.\n` +
        '[e2e] A starved run fails in ways that look like product regressions — hook\n' +
        '[e2e] timeouts, then pg-pool connection failures, then the testcontainer being\n' +
        '[e2e] killed. If this run goes red in its back half, suspect memory first.';
    console.warn(message);
    return message;
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
