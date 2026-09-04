import { existsSync } from 'node:fs';
import { ActivityModule } from '../activity.module';
import { ActivityPlugin } from './activity-plugin';

/**
 * The plugin's registration surface.
 *
 * "Takes no configuration" is a promise to the **host**: `ActivityPlugin()`
 * appears bare in `apps/server/src/plugins.ts`, in `server-e2e`'s plugin list
 * and in the scaffolder's template, so growing a required option is a breaking
 * change to three composition roots at once — and one that fails at compile
 * time in this repo while landing on an installed app as a runtime surprise.
 *
 * Arity is asserted from the function's own parameter list rather than from
 * `Function.length`, which counts only the parameters before the first default:
 * `ActivityPlugin(config = {})` has a `length` of 0 while very much taking
 * configuration.
 */

/** The literal parameter list of a function, as written. */
function parametersOf(fn: (...args: never[]) => unknown): string {
    const source = fn.toString();
    return source.slice(source.indexOf('(') + 1, source.indexOf(')')).trim();
}

describe('ActivityPlugin', () => {
    it('is constructed with no arguments at all [activity:I-24]', () => {
        expect(parametersOf(ActivityPlugin)).toBe('');
        expect(ActivityPlugin).toHaveLength(0);
    });

    it('builds its module with no arguments either [activity:I-24]', () => {
        expect(parametersOf(ActivityModule.forRoot)).toBe('');
        expect(ActivityModule.forRoot).toHaveLength(0);
    });

    it('is registrable bare, and says where its migrations live [activity:I-24]', () => {
        const plugin = ActivityPlugin();

        expect(plugin.name).toBe('activity');
        expect(plugin.module).toEqual(
            expect.objectContaining({ module: ActivityModule, global: true })
        );
        expect(plugin.migrations?.table).toBe('__drizzle_migrations_activity');

        // The descriptor is a lazy path, so a wrong one is otherwise only
        // discovered when a host migrates. Resolve it: the SQL this package
        // ships has to actually be where it points.
        const dir = plugin.migrations?.dir();
        expect(dir?.endsWith('/migrations')).toBe(true);
        expect(existsSync(dir as string)).toBe(true);
    });

    it('carries no config-shaped surface for a host to fill in [activity:I-24]', () => {
        // The complement of the arity checks: an options bag smuggled onto the
        // returned descriptor would leave both signatures empty.
        expect(Object.keys(ActivityPlugin()).sort()).toEqual([
            'migrations',
            'module',
            'name'
        ]);
    });
});
