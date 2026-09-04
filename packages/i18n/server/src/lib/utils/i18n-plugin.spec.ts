import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { I18nServerPlugin } from './i18n-plugin';

/**
 * `I18nServerPlugin` validates its locale config **eagerly** (at
 * construction), so a misconfigured host fails before boot rather than on the
 * first request. These cover the invariants: non-empty, unique well-formed
 * slugs, exactly one default.
 */
describe('I18nServerPlugin config validation', () => {
    it('accepts a valid config with exactly one default', () => {
        expect(() =>
            I18nServerPlugin({
                locales: [
                    { slug: 'en', name: 'English', isDefault: true },
                    { slug: 'pt-br', name: 'Português (Brasil)' }
                ]
            })
        ).not.toThrow();
    });

    it('names the plugin "i18n" and carries its config', () => {
        const config = {
            locales: [{ slug: 'en', name: 'English', isDefault: true }]
        };
        const plugin = I18nServerPlugin(config);
        expect(plugin.name).toBe('i18n');
        expect(plugin.i18nConfig).toBe(config);
    });

    it('rejects an empty locale list', () => {
        expect(() => I18nServerPlugin({ locales: [] })).toThrow(
            /at least one locale/
        );
    });

    it('rejects zero defaults', () => {
        expect(() =>
            I18nServerPlugin({ locales: [{ slug: 'en', name: 'English' }] })
        ).toThrow(/Exactly one locale must set isDefault \(got 0\)/);
    });

    it('rejects two defaults', () => {
        expect(() =>
            I18nServerPlugin({
                locales: [
                    { slug: 'en', name: 'English', isDefault: true },
                    { slug: 'de', name: 'Deutsch', isDefault: true }
                ]
            })
        ).toThrow(/Exactly one locale must set isDefault \(got 2\)/);
    });

    it('rejects duplicate slugs', () => {
        expect(() =>
            I18nServerPlugin({
                locales: [
                    { slug: 'en', name: 'English', isDefault: true },
                    { slug: 'en', name: 'English (US)' }
                ]
            })
        ).toThrow(/Duplicate locale slug "en"/);
    });

    it('rejects a malformed slug', () => {
        expect(() =>
            I18nServerPlugin({
                locales: [{ slug: 'EN_US', name: 'English', isDefault: true }]
            })
        ).toThrow(/is invalid/);
    });

    it('rejects an empty locale name', () => {
        expect(() =>
            I18nServerPlugin({
                locales: [{ slug: 'en', name: '   ', isDefault: true }]
            })
        ).toThrow(/empty name/);
    });
});

/**
 * The plugin owns **no tables**. That is a contract, not an accident: locales
 * live in the config and the `locale` / `locale_group_id` columns live on the
 * host-owned generated content tables, so a `drizzle.config.ts` appearing here
 * would mean the boundary had moved without anyone saying so — and the host
 * would start applying migrations for a plugin that has nothing to migrate.
 */
describe('I18nServerPlugin schema ownership [i18n:I-32]', () => {
    /** `src/lib/utils` → the package root. */
    const packageRoot = join(__dirname, '..', '..', '..');

    it('declares no migrations on the plugin descriptor', () => {
        const plugin = I18nServerPlugin({
            locales: [{ slug: 'en', name: 'English', isDefault: true }]
        });
        expect(plugin.migrations).toBeUndefined();
    });

    it('ships neither a drizzle config nor a migrations folder', () => {
        expect(existsSync(join(packageRoot, 'drizzle.config.ts'))).toBe(false);
        expect(existsSync(join(packageRoot, 'migrations'))).toBe(false);
        // Guard the guard: the paths above are only meaningful if they are
        // resolved against the real package root.
        expect(existsSync(join(packageRoot, 'package.json'))).toBe(true);
    });
});
