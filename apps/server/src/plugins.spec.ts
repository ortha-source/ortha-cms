import config from '../ortha.config';
import { buildPlugins } from './plugins';

/**
 * The shipped composition, asserted.
 *
 * `apps/server-e2e` never runs this function — it builds its own mirror
 * (`apps/server-e2e/src/support/plugins.ts`) so a change to the host's content
 * types cannot break the suite. That decoupling is right, and it leaves the real
 * registry with no test at all: a plugin dropped from the array here removes its
 * routes and silently degrades everything that injects its ports `@Optional()`
 * (measured: removing `ActivityPlugin` boots clean, logs nothing, and stops
 * writing audit rows), while the e2e run stays green because it never looked.
 *
 * So this asserts the two things about the list that are actually load-bearing —
 * who is in it, and what order the migrations run in — and nothing about DI
 * order, which is genuinely free (every plugin module is global, and every
 * `onPluginInit` runs before `NestFactory.create`).
 */

/** Every plugin the product ships, in registration order. */
const EXPECTED_PLUGINS = [
    'database',
    'identity',
    'workspaces',
    'activity',
    'users',
    'content',
    'content-graphql',
    'media',
    'i18n',
    'copilot',
    'mcp'
];

describe('buildPlugins()', () => {
    it('registers exactly the shipped plugin set', () => {
        // A missing name is a capability that quietly stopped existing; an extra
        // one is a surface nobody decided to expose.
        expect(buildPlugins(config).map((plugin) => plugin.name)).toEqual(
            EXPECTED_PLUGINS
        );
    });

    it('orders the migration-shipping plugins so their foreign keys resolve on a fresh database', () => {
        // `applyPluginMigrations` walks this array in order, and there is no
        // outer transaction, so a plugin whose tables reference another's must
        // come after it. The mistake is invisible on an already-migrated
        // database — measured: moving `workspaces` above `identity` re-migrates
        // an existing database happily and fails a *fresh* one with
        // `relation "users" does not exist`. So it ships, and bites the next
        // clean install rather than its author.
        const migrating = buildPlugins(config)
            .filter((plugin) => plugin.migrations)
            .map((plugin) => plugin.name);

        expect(migrating.indexOf('identity')).toBeLessThan(
            migrating.indexOf('workspaces')
        );
        expect(migrating.indexOf('workspaces')).toBeLessThan(
            migrating.indexOf('activity')
        );
    });

    it('gives every migration-shipping plugin its own tracking table', () => {
        // Two plugins sharing one `__drizzle_migrations_*` table would read each
        // other's history as their own and skip their real migrations.
        const tables = buildPlugins(config)
            .filter((plugin) => plugin.migrations)
            .map((plugin) => plugin.migrations?.table);

        expect([...new Set(tables)]).toEqual(tables);
        expect(tables.every((table) => table?.startsWith('__drizzle_migrations_'))).toBe(true);
    });

    it('keeps the content plugin and its GraphQL adapter as one registration, not two schemas', () => {
        // `ContentGraphqlPlugin` takes the *same* `content` value the registry
        // registers, which is what lets a GraphQL type-name collision fail at
        // composition instead of on the first request from a workspace granted
        // both types.
        const plugins = buildPlugins(config);
        const content = plugins.find((plugin) => plugin.name === 'content');
        const graphql = plugins.find(
            (plugin) => plugin.name === 'content-graphql'
        );

        expect(content).toBeDefined();
        expect(graphql).toBeDefined();
        // The adapter owns no schema of its own — the content plugin's
        // host-owned migrations are the only content migrations in the run.
        expect(graphql?.migrations).toBeUndefined();
        expect(content?.migrations?.table).toBe('__drizzle_migrations_content');
    });
});
