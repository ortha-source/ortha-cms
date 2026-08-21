import type { ServerPlugin } from '@orthacms/bootstrap-server';

const migrate = jest.fn();
const end = jest.fn();
const poolConstructor = jest.fn();

jest.mock('pg', () => ({
    Pool: class {
        end = end;
        constructor(config: unknown) {
            poolConstructor(config);
        }
    }
}));
jest.mock('drizzle-orm/node-postgres', () => ({
    drizzle: (pool: unknown) => ({ pool })
}));
jest.mock('drizzle-orm/node-postgres/migrator', () => ({
    migrate: (...args: unknown[]) => migrate(...args)
}));

import { applyPluginMigrations, describeTarget } from './apply';

const URL = 'postgresql://ortha:secret@localhost:5432/ortha_cms';

/** The only part of `ServerPlugin` this loop reads. */
function plugin(name: string, dir = `/migrations/${name}`): ServerPlugin {
    return {
        name,
        migrations: { dir: () => dir, table: `__drizzle_migrations_${name}` }
    } as ServerPlugin;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('describeTarget', () => {
    it('names host, port and database without the credentials', () => {
        expect(describeTarget(URL)).toBe('localhost:5432/ortha_cms');
    });

    it.each([
        ['postgresql://localhost/ortha', 'localhost/ortha'],
        ['postgresql://localhost:5432/', 'localhost:5432/(default)']
    ])('handles %s', (url, expected) => {
        expect(describeTarget(url)).toBe(expected);
    });

    it('says so rather than guessing when the URL will not parse', () => {
        expect(describeTarget('not-a-url')).toBe('(unparseable DATABASE_URL)');
    });

    it('never leaks the password', () => {
        expect(describeTarget(URL)).not.toContain('secret');
    });
});

describe('applyPluginMigrations', () => {
    it('opens no connection when no plugin ships migrations', async () => {
        await applyPluginMigrations(
            [{ name: 'mcp' } as ServerPlugin],
            'postgresql://nowhere/none'
        );

        expect(poolConstructor).not.toHaveBeenCalled();
        expect(migrate).not.toHaveBeenCalled();
    });

    /**
     * The host's plugin order is load-bearing — workspaces' `memberships`
     * FK-references identity's `users`, so identity has to migrate first — and
     * nothing declares that dependency. This loop preserving the order it is
     * given is therefore the whole guarantee, which makes it worth asserting
     * rather than assuming.
     */
    it('applies plugins in exactly the order the host listed them', async () => {
        await applyPluginMigrations(
            [
                plugin('database'),
                plugin('identity'),
                plugin('workspaces'),
                { name: 'mcp' } as ServerPlugin,
                plugin('content')
            ],
            URL
        );

        expect(
            migrate.mock.calls.map(([, options]) => options.migrationsTable)
        ).toEqual([
            '__drizzle_migrations_database',
            '__drizzle_migrations_identity',
            '__drizzle_migrations_workspaces',
            '__drizzle_migrations_content'
        ]);
    });

    it('passes each plugin its own folder and tracking table', async () => {
        await applyPluginMigrations([plugin('identity', '/a/b')], URL);

        expect(migrate).toHaveBeenCalledWith(expect.anything(), {
            migrationsFolder: '/a/b',
            migrationsTable: '__drizzle_migrations_identity'
        });
    });

    it('names the database it is about to change', async () => {
        await applyPluginMigrations([plugin('identity')], URL);

        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining('localhost:5432/ortha_cms')
        );
    });

    describe('when a plugin fails partway through the list', () => {
        beforeEach(() => {
            migrate.mockImplementation((_db, options) => {
                if (options.migrationsTable.endsWith('workspaces')) {
                    throw new Error('relation "users" does not exist');
                }
            });
        });

        const run = () =>
            applyPluginMigrations(
                [
                    plugin('database'),
                    plugin('identity'),
                    plugin('workspaces'),
                    plugin('content')
                ],
                URL
            );

        it('names the plugin, how far it got, and the order it depends on', async () => {
            await expect(run()).rejects.toThrow(
                /Migrating plugin "workspaces" failed — applied 2 of 4 plugin\(s\)/
            );
            await expect(run()).rejects.toThrow(/plugin ORDER/);
        });

        it('keeps the original error as the cause', async () => {
            const error = await run().catch((e: Error) => e);

            expect((error.cause as Error).message).toBe(
                'relation "users" does not exist'
            );
        });

        it('does not attempt the plugins after it', async () => {
            await run().catch(() => undefined);

            expect(
                migrate.mock.calls.map(([, o]) => o.migrationsTable)
            ).not.toContain('__drizzle_migrations_content');
        });

        it('still closes the pool', async () => {
            await run().catch(() => undefined);

            expect(end).toHaveBeenCalledTimes(1);
        });
    });

    it('closes the pool on success too', async () => {
        await applyPluginMigrations([plugin('identity')], URL);

        expect(end).toHaveBeenCalledTimes(1);
    });
});
