/**
 * Locale configuration contracts. The host declares its locales once, on the
 * server plugin (`I18nServerPlugin({ locales })`) — the single source of
 * truth. The admin fetches them from `GET /api/i18n/locales`; nothing is
 * duplicated client-side.
 */

import type { LocaleDir } from '../i18n.constants';

export type { LocaleDir };

/** One configured locale. */
export interface LocaleDef {
    /**
     * Stable machine slug stored on entry rows (e.g. `en`, `de`, `pt-br`).
     *
     * **It is a BCP-47 language tag**, and that is a contract, not a
     * coincidence: the slug regex is the lowercase BCP-47 shape (a 2–3 letter
     * primary tag with optional `-` subtags), and every value the plugin
     * returns under `locale` — here, on `EntryLocaleItem`, on the `locale`
     * column of an entry payload — may be used verbatim as an HTML `lang`
     * value. A consumer therefore sets `lang={entry.locale}` on the field
     * region, the preview, and the published page without a mapping table, and
     * a screen reader announces German content with German pronunciation
     * instead of the document's `lang="en"` (WCAG 3.1.2 Language of Parts).
     * Keeping the two identical is why nothing here uppercases a region subtag.
     */
    slug: string;
    /** Human display name (e.g. "English"). */
    name: string;
    /**
     * The default locale — applied when a request names none. Exactly one
     * locale must set it (validated eagerly at plugin construction).
     */
    isDefault?: boolean;
    /**
     * Text direction of content written in this locale — the HTML `dir` value
     * a consumer sets alongside `lang`.
     *
     * **Optional in config, always present on the wire.** Omit it and the
     * plugin infers it from the slug (`ar`, `he`, `fa`, `ur`, … → `rtl`;
     * everything else `ltr`), so an RTL language is configured like any other;
     * declare it to override the inference. `GET /api/i18n/locales` always
     * returns a resolved value, so the admin never has to decide for itself
     * whether Arabic is right-to-left (WCAG 1.3.2 Meaningful Sequence).
     */
    dir?: LocaleDir;
}

/** Options accepted by `I18nServerPlugin()`. */
export interface I18nPluginConfig {
    /** The available locales, in display order. Exactly one `isDefault`. */
    locales: LocaleDef[];
    /**
     * What to do at boot when entry rows exist in a locale the config no
     * longer declares — `'fail'` (the default) aborts the boot, `'warn'` logs
     * the report and continues.
     *
     * Removing a locale from this config does **not** remove its rows, and the
     * rows are then invisible to every read path: `?locale=` 400s the slug, the
     * locale panel iterates the configured set, coverage and the virtual
     * filters exclude it. The data is intact and unreachable — the worst shape
     * for a silent failure, because nothing in the product ever mentions it
     * again. Failing the boot puts the choice in front of whoever changed the
     * config, while it is still their change. Set `'warn'` for a deployment
     * that is knowingly mid-migration.
     */
    orphanedLocales?: OrphanedLocalePolicy;
}

/** How the plugin reacts to rows left behind by a removed locale. */
export type OrphanedLocalePolicy = 'fail' | 'warn';
