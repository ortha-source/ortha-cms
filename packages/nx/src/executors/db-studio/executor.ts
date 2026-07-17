import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { runDrizzleKitStudio } from '../../lib/drizzle/studio';
import { createTsJiti } from '../../lib/jiti';

/** Options for the `db-studio` executor. */
export interface DbStudioExecutorOptions {
    /** Path to the host's ortha.config.ts (relative to the workspace root). */
    config: string;
    /** Host interface Studio's local server binds to. */
    host?: string;
    /** Port Studio's local server listens on. */
    port?: number;
}

/** Minimal shape this executor needs from the host config. */
interface HostConfig {
    database: { url: string };
    [key: string]: unknown;
}

/**
 * Launches Drizzle Studio against the host database. Resolves the connection
 * URL from the host's `ortha.config.ts` (the single place that reads
 * `DATABASE_URL`), the same source `db:migrate` uses, then hands it to
 * drizzle-kit via an ephemeral config. Side-effecting and long-running —
 * never cached.
 */
export default async function dbStudioExecutor(
    options: DbStudioExecutorOptions,
    context: ExecutorContext
): Promise<{ success: boolean }> {
    const jiti = createTsJiti(__filename);

    const configModule = await jiti.import<{ default: HostConfig }>(
        join(context.root, options.config)
    );
    const url = configModule.default.database?.url;

    if (!url) {
        throw new Error(
            'DATABASE_URL is not set — Drizzle Studio needs a live database ' +
                'connection. Set it in your .env before running db:studio.'
        );
    }

    runDrizzleKitStudio(url, { host: options.host, port: options.port });

    return { success: true };
}
