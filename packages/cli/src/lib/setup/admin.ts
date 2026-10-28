import { createRequire } from 'node:module';
import { join } from 'node:path';

import { Client } from 'pg';

import { LAYOUT, loadHost } from '../project';

/** Whether an account with this address exists already. */
export async function accountExists(
    databaseUrl: string,
    email: string
): Promise<boolean> {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
        const { rows } = await client.query<{ exists: boolean }>(
            'select exists(select 1 from users where email = $1) as exists',
            [email.trim().toLowerCase()]
        );
        return rows[0]?.exists ?? false;
    } finally {
        await client.end();
    }
}

/**
 * Creates the administrator by booting the app's own plugins once, with the
 * credentials in this process's environment only.
 *
 * Identity's root-admin seeder does the work — the same code a boot with
 * `ORTHACMS_ROOT_ADMIN_*` runs, hashing included — so nothing here knows the
 * shape of the users table, and the password is never written to a file.
 * Background workers stay off for the moment the context is up.
 *
 * Needs the app built and migrated: `orthacms setup` does both first.
 */
export async function createAdministrator(
    root: string,
    account: { email: string; password: string; name?: string }
): Promise<void> {
    const saved = process.env;
    process.env = {
        ...saved,
        ORTHACMS_ROOT_ADMIN_EMAIL: account.email,
        ORTHACMS_ROOT_ADMIN_PASSWORD: account.password,
        ORTHACMS_ROOT_ADMIN_NAME: account.name ?? '',
        ORTHACMS_WORKERS: 'false',
        COPILOT_ENABLED: 'false',
        MCP_ENABLED: 'false'
    };
    const fromApp = createRequire(join(root, 'package.json'));
    // A config compiled earlier in this process (by `migrate`) has already
    // read the environment; the provisioning pass needs a fresh read.
    for (const key of Object.keys(fromApp.cache)) {
        if (key.startsWith(join(root, LAYOUT.serverOut)))
            delete fromApp.cache[key];
    }
    try {
        fromApp('reflect-metadata');
        const { NestFactory } = fromApp('@nestjs/core') as {
            NestFactory: {
                createApplicationContext(
                    module: unknown,
                    options: object
                ): Promise<{ close(): Promise<void> }>;
            };
        };
        const { ServerModule } = fromApp('@orthacms/bootstrap-server') as {
            ServerModule: { forRoot(plugins: unknown[]): unknown };
        };
        const { closeDatabase } = fromApp('@orthacms/database') as {
            closeDatabase(): Promise<void>;
        };
        const { plugins } = loadHost(root);
        for (const plugin of plugins) await plugin.onPluginInit?.();
        const app = await NestFactory.createApplicationContext(
            ServerModule.forRoot(plugins),
            { logger: ['error'] }
        );
        await app.close();
        await closeDatabase();
    } finally {
        process.env = saved;
    }
}
