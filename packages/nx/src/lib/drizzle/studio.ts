import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Where Drizzle Studio's local server should bind. */
export interface StudioServerOptions {
    /** Host interface to bind (drizzle-kit default is `127.0.0.1`). */
    host?: string;
    /** Port to listen on (drizzle-kit default is `4983`). */
    port?: number;
}

/**
 * Launches Drizzle Studio against the host database.
 *
 * `drizzle-kit studio` reads its connection from a config's `dbCredentials`,
 * but the workspace's committed drizzle configs are deliberately schema-only
 * (no secrets — generation never touches a database). So we synthesize an
 * **ephemeral** config in a temp dir and hand it to drizzle-kit. The config
 * references `process.env.DATABASE_URL` rather than inlining the URL, and we
 * pass the resolved URL to the child process's env — so the credential is
 * never written to disk. The ephemeral config exports a plain object (no
 * `import`), so drizzle-kit's bundler needs no module resolution from the
 * temp dir.
 *
 * Studio introspects the live database directly, so no `schema` is needed —
 * every applied table shows up, with relations derived from the DB's foreign
 * keys. The process runs in the foreground until interrupted (Ctrl+C).
 */
export function runDrizzleKitStudio(
    databaseUrl: string,
    options: StudioServerOptions = {}
): void {
    // drizzle-kit's `exports` map blocks resolving `./bin.cjs` directly, so
    // resolve the package's main entry and locate the sibling bin.
    const bin = join(dirname(require.resolve('drizzle-kit')), 'bin.cjs');

    const dir = mkdtempSync(join(tmpdir(), 'ortha-studio-'));
    const configPath = join(dir, 'drizzle.config.ts');
    writeFileSync(
        configPath,
        // No `import`: drizzle-kit reads the module's default export, and a
        // plain object keeps the ephemeral config resolution-free.
        `export default {\n` +
            `    dialect: 'postgresql',\n` +
            `    dbCredentials: { url: process.env.DATABASE_URL }\n` +
            `};\n`,
        'utf8'
    );

    const args = [bin, 'studio', `--config=${configPath}`];
    if (options.host) {
        warnIfExposed(options.host, options.port);
        args.push(`--host=${options.host}`);
    }
    if (options.port) {
        args.push(`--port=${String(options.port)}`);
    }

    try {
        execFileSync(process.execPath, args, {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: databaseUrl }
        });
    } catch (error) {
        // Ctrl+C is the documented way to stop Studio, and `execFileSync`
        // throws when the child is terminated by a signal. Reporting the
        // documented exit as a failed target trains people to ignore red.
        if (terminatedByUser(error)) return;
        throw error;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** Interfaces that keep Studio on this machine. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Studio is an **unauthenticated** browser with full read/write access to
 * whatever `DATABASE_URL` points at — there is no login, and every table is
 * editable. Bound to loopback that is a local tool; bound to anything else it
 * is a database console offered to the network, and drizzle-kit says nothing
 * about the difference. One flag is the whole distance between the two, so say
 * it out loud rather than letting a `--host` typed once on a shared network go
 * unremarked.
 */
function warnIfExposed(host: string, port?: number): void {
    if (LOOPBACK.has(host.toLowerCase())) return;

    console.warn(
        `\n!! Drizzle Studio is binding ${host}:${port ?? 4983}, not loopback.\n` +
            `   Studio has no authentication and full read/write access to this\n` +
            `   database — anyone who can reach that address can read and change\n` +
            `   every row. Only do this on a network you control, and stop it when\n` +
            `   you are done. Drop --host to keep it on this machine.\n`
    );
}

/** Whether the child was killed by an interrupt rather than failing on its own. */
function terminatedByUser(error: unknown): boolean {
    const signal = (error as { signal?: NodeJS.Signals | null } | null)?.signal;

    return signal === 'SIGINT' || signal === 'SIGTERM';
}
