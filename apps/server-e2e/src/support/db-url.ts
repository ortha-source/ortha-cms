import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Hand-off channel for the testcontainer's connection string.
 *
 * `global-setup` runs in Jest's main process; specs run in a worker. The
 * worker inherits `process.env` at fork time, so the URI normally arrives
 * via `DATABASE_URL`. We also persist it to a temp file as a fallback for
 * runners/modes where that inheritance doesn't hold, and read whichever is
 * present. One source of truth, two delivery paths.
 */
const URL_FILE = join(tmpdir(), 'ortha-server-e2e', 'database-url');

/** Publish the connection string for workers to pick up. Called by setup. */
export function publishDatabaseUrl(connectionString: string): void {
    process.env['DATABASE_URL'] = connectionString;
    mkdirSync(dirname(URL_FILE), { recursive: true });
    writeFileSync(URL_FILE, connectionString, 'utf8');
}

/** Resolve the connection string in a worker. Env first, file fallback. */
export function resolveDatabaseUrl(): string {
    const fromEnv = process.env['DATABASE_URL'];
    if (fromEnv) {
        return fromEnv;
    }
    try {
        return readFileSync(URL_FILE, 'utf8').trim();
    } catch {
        throw new Error(
            'No DATABASE_URL available — is the e2e global-setup running the Postgres testcontainer?'
        );
    }
}

/** Remove the temp handoff file. Called by teardown. */
export function clearDatabaseUrl(): void {
    rmSync(dirname(URL_FILE), { recursive: true, force: true });
}
