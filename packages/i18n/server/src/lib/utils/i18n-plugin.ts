import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { LOCALE_SLUG_MAX_LENGTH, LOCALE_SLUG_RE } from '../i18n.constants';
import type { I18nPluginConfig } from '../types/locale';
import { I18nModule } from '../i18n.module';

/**
 * Server plugin for content localization, carrying its config alongside the
 * standard plugin shape.
 */
export interface I18nServerPluginType extends ServerPlugin {
    /** The validated locale configuration. */
    i18nConfig: I18nPluginConfig;
}

/**
 * Validate the locale config **eagerly** (like `ContentPlugin`'s registry):
 * a misconfigured host fails at construction — before boot, before the first
 * request. At least one locale; unique, well-formed slugs; exactly one
 * default.
 */
function assertConfig(config: I18nPluginConfig): void {
    if (!config.locales.length) {
        throw new Error('I18nServerPlugin requires at least one locale.');
    }
    const seen = new Set<string>();
    for (const locale of config.locales) {
        if (
            !LOCALE_SLUG_RE.test(locale.slug) ||
            locale.slug.length > LOCALE_SLUG_MAX_LENGTH
        ) {
            throw new Error(
                `Locale slug "${locale.slug}" is invalid — lowercase 2-3 letter ` +
                    `primary tag with optional "-" subtags (e.g. "en", "pt-br").`
            );
        }
        if (seen.has(locale.slug)) {
            throw new Error(`Duplicate locale slug "${locale.slug}".`);
        }
        seen.add(locale.slug);
        if (!locale.name.trim()) {
            throw new Error(`Locale "${locale.slug}" has an empty name.`);
        }
    }
    const defaults = config.locales.filter((locale) => locale.isDefault);
    if (defaults.length !== 1) {
        throw new Error(
            `Exactly one locale must set isDefault (got ${defaults.length}).`
        );
    }
}

/**
 * Creates the i18n plugin — content localization for `i18n: true` content
 * types. Register it **after** `ContentPlugin`: it binds content-server's
 * `CONTENT_ENTRY_EXTENSION` port (locale scoping, create stamping,
 * shared-field sync, locale filters) and serves the locale-domain API under
 * `/api/i18n` (locales list, per-entry locale panel, batched summaries,
 * create-translation).
 *
 * Owns **no tables and no migrations** — locales live in this config, and
 * the `locale` / `locale_group_id` columns live on the host-owned generated
 * content tables (added by the `i18n: true` type flag).
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity),
 *     ContentPlugin({ types: contentTypes }),
 *     I18nServerPlugin({
 *       locales: [
 *         { slug: 'en', name: 'English', isDefault: true },
 *         { slug: 'de', name: 'Deutsch' }
 *       ]
 *     })
 *   ]
 * });
 * ```
 */
export function I18nServerPlugin(
    config: I18nPluginConfig
): I18nServerPluginType {
    assertConfig(config);
    return {
        name: 'i18n',
        module: I18nModule.forRoot(config),
        i18nConfig: config
    };
}
