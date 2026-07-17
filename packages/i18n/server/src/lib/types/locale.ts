/**
 * Locale configuration contracts. The host declares its locales once, on the
 * server plugin (`I18nServerPlugin({ locales })`) — the single source of
 * truth. The admin fetches them from `GET /api/i18n/locales`; nothing is
 * duplicated client-side.
 */

/** One configured locale. */
export interface LocaleDef {
    /**
     * Stable machine slug stored on entry rows (e.g. `en`, `de`, `pt-br`).
     * Lowercase BCP-47-ish: a 2–3 letter primary tag, optional `-` subtags.
     */
    slug: string;
    /** Human display name (e.g. "English"). */
    name: string;
    /**
     * The default locale — applied when a request names none. Exactly one
     * locale must set it (validated eagerly at plugin construction).
     */
    isDefault?: boolean;
}

/** Options accepted by `I18nServerPlugin()`. */
export interface I18nPluginConfig {
    /** The available locales, in display order. Exactly one `isDefault`. */
    locales: LocaleDef[];
}
