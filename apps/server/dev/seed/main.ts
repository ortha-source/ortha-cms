/**
 * The dev seed: fills an **empty** database with the records `apps/server`'s
 * content model and every plugin need to be exercised by hand.
 *
 *     npx nx run server:dev:reset    # drop, migrate, seed — the usual entry point
 *     npx nx run server:dev:seed     # seed a database that was just migrated
 *
 * It boots the real plugin list in-process (an application context — no HTTP)
 * and writes through the services, never raw SQL where a service exists:
 * a row inserted behind a service's back has no revision, no outbox event and
 * no activity, and protection reads an entry without a head revision as
 * unprotected. Raw SQL is kept for what no service will do — custom roles,
 * expired tokens, backdated timestamps — and each such place says why.
 *
 * Secrets a person needs afterwards (API tokens, invite and reset links) are
 * written to `dev/seed/.output.md`, which git ignores.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServerModule } from '@orthacms/bootstrap-server';
import { closeDatabase, getDatabase } from '@orthacms/database';
import { sql } from 'drizzle-orm';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import config from '../../orthacms.config';
import { buildPlugins } from '../../src/plugins';
import { SeedContext } from './context';
import { seedIdentity } from './phases/01-identity';
import { seedWorkspaces } from './phases/02-workspaces';
import { seedMedia } from './phases/03-media';
import { seedContent } from './phases/04-content';
import { seedProtection } from './phases/05-protection';
import { seedSegments } from './phases/06-segments';
import { seedViews } from './phases/07-views';
import { seedAlarms } from './phases/08-alarms';
import { seedCopilot } from './phases/09-copilot';
import { seedApiTokens } from './phases/10-api-tokens';
import { seedWebhooks } from './phases/11-webhooks';
import { seedBackdate } from './phases/12-backdate';

const PHASES: [string, (ctx: SeedContext) => Promise<void>][] = [
    ['identity', seedIdentity],
    ['workspaces', seedWorkspaces],
    ['media', seedMedia],
    ['content', seedContent],
    ['protection', seedProtection],
    ['segments', seedSegments],
    ['views', seedViews],
    ['alarms', seedAlarms],
    ['copilot', seedCopilot],
    ['api tokens', seedApiTokens],
    // Last but one: an endpoint seeded earlier would turn every content write
    // above into a real delivery attempt.
    ['webhooks', seedWebhooks],
    // Last: services stamp `now()`, so history is rewritten after the fact.
    ['backdate', seedBackdate]
];

const OUTPUT_FILE = join(__dirname, '../dev/seed/.output.md');

async function main(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
        throw new Error('[seed] refusing to seed with NODE_ENV=production.');
    }

    const plugins = buildPlugins(config);
    for (const plugin of plugins) await plugin.onPluginInit?.();
    await assertEmpty();

    const app = await NestFactory.createApplicationContext(
        ServerModule.forRoot(plugins),
        { logger: ['error', 'warn'] }
    );
    const ctx = new SeedContext(app);
    try {
        for (const [name, phase] of PHASES) {
            const started = Date.now();
            try {
                await phase(ctx);
            } catch (error) {
                throw new Error(`[seed] phase "${name}" failed`, {
                    cause: error
                });
            }
            console.log(`[seed] ${name} — ${Date.now() - started} ms`);
        }
        await drainOutbox();
        writeOutput(ctx);
        console.log(`[seed] done — see ${OUTPUT_FILE}`);
    } finally {
        await app.close();
        await closeDatabase();
    }
}

/**
 * The seed assumes a fresh database: ids are generated, so running it twice
 * would duplicate everything rather than converge. `dev:reset` gives it one.
 */
async function assertEmpty(): Promise<void> {
    const { rows } = await getDatabase().execute<{ count: number }>(
        sql`select count(*)::int as count from workspaces`
    );
    if ((rows[0]?.count ?? 0) > 0) {
        throw new Error(
            '[seed] the database already has workspaces. Run `npx nx run server:dev:reset` for a fresh one.'
        );
    }
}

/**
 * Subscribers (activity, protection, alarms) react to the outbox after each
 * commit; wait for them so the database is complete when the process exits.
 */
async function drainOutbox(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const { rows } = await getDatabase().execute<{ count: number }>(
            sql`select count(*)::int as count from outbox_events where dispatched_at is null and attempts < 15`
        );
        if ((rows[0]?.count ?? 0) === 0) return;
        if (Date.now() > deadline) {
            throw new Error('[seed] the outbox did not drain within 60 s.');
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

function writeOutput(ctx: SeedContext): void {
    const body = [
        '# Dev seed output',
        '',
        `Generated ${new Date().toISOString()}. Regenerated by every \`dev:reset\`; git ignores it.`,
        '',
        ...ctx.output.flatMap(({ title, lines }) => [
            `## ${title}`,
            '',
            ...lines,
            ''
        ])
    ].join('\n');
    mkdirSync(join(OUTPUT_FILE, '..'), { recursive: true });
    writeFileSync(OUTPUT_FILE, body);
}

main().catch((error: unknown) => {
    Logger.error(
        'The seed failed.',
        error instanceof Error ? (error.stack ?? error.message) : String(error)
    );
    if (error instanceof Error && error.cause) {
        const cause = error.cause;
        Logger.error(
            cause instanceof Error
                ? (cause.stack ?? cause.message)
                : String(cause)
        );
    }
    process.exit(1);
});
