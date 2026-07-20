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
