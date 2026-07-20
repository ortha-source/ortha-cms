import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { I18nPluginConfig } from '../types/locale';
import { LocaleSet } from '../domain/value-objects/locale-set';
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
 * request. Building the domain {@link LocaleSet} enforces every invariant (at
 * least one locale; unique, well-formed slugs; non-blank names; exactly one
 * default), so the raw-string rules live on the `Locale` / `LocaleSet` value
 * objects rather than inline here.
 */
function assertConfig(config: I18nPluginConfig): void {
    LocaleSet.fromDefs(config.locales);
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
