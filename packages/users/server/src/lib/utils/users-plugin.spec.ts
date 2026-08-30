import { UsersModule } from '../users.module';
import { UsersPlugin } from './users-plugin';

/**
 * The plugin descriptor — chiefly the two things it deliberately **omits**.
 *
 * Every table this package touches (`users`, `roles`, `memberships`,
 * `workspaces`, `sessions`, `tokens`) is owned and migrated by identity or
 * workspaces. A `migrations` descriptor appearing here would give the users
 * plugin its own tracking table and its own history over tables it does not
 * own — the kind of thing that is added in one line, works locally, and only
 * shows up as two plugins racing the same schema on a real deployment. Nothing
 * else in the repo asserts the absence.
 */
describe('UsersPlugin', () => {
    it('names itself `users` and mounts the module', () => {
        const plugin = UsersPlugin();

        expect(plugin.name).toBe('users');
        expect(plugin.module).toEqual(UsersModule.forRoot());
    });

    it('ships no migrations — it owns no schema', () => {
        expect(UsersPlugin().migrations).toBeUndefined();
    });

    it('declares no lifecycle hook — it opens no connection of its own', () => {
        // Identity's tables are reached through the database plugin's single
        // connection; there is nothing for this plugin to set up before boot.
        expect(UsersPlugin().onPluginInit).toBeUndefined();
    });

    it('carries no config', () => {
        expect(Object.keys(UsersPlugin()).sort()).toEqual(['module', 'name']);
    });
});
