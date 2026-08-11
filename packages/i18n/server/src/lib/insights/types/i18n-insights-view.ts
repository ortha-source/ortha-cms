/**
 * Read-side view shapes for the localization Insights widget.
 *
 * A **transport contract**, restated verbatim by `i18n-admin` (the admin can't
 * import a server package across the module boundary). Derived live from the
 * localized collection tables — this plugin owns no table and keeps no
 * projection.
 */

/** How much of the workspace's localized content exists in one locale. */
export interface LocaleCoverageView {
    /** The configured locale slug. */
    locale: string;
    /** Its display name, from the host's config. */
    name: string;
    /** Whether it is the configured default locale. */
    isDefault: boolean;
    /** Records that have a row in this locale. */
    translated: number;
    /** Records that do not. */
    missing: number;
}

/**
 * One localized content type's own coverage.
 *
 * The same four figures as the workspace envelope, scoped to a type — which is
 * what turns "122 records need translating" into "and 88 of them are articles".
 * A workspace-wide total says work exists; only the per-type split says where.
 */
export interface ContentTypeCoverageView {
    /** The type's machine name. */
    name: string;
    /** Its human label. */
    label: string;
    /** Translation groups of this type. */
    records: number;
    /** Of those, the ones present in every configured locale. */
    localized: number;
    /** Of those, the ones present in exactly one locale. */
    notLocalized: number;
    /** Of those, the ones missing at least one locale. */
    requiresLocalization: number;
}

/**
 * Localization coverage across every `i18n: true` content type.
 *
 * The unit is a **record**, not a row: a localized entry is one row per
 * language sharing a `locale_group_id`, so counting rows would report a
 * workspace of 40 stories in 3 languages as 120 things and make every
 * percentage meaningless. Every figure below counts translation groups.
 *
 * `notLocalized` is a **subset** of `requiresLocalization`, not a second slice
 * of it — a record in one language of four both "has no translations" and
 * "needs some". They are separate because they are separate jobs: one is
 * starting a translation, the other is finishing it.
 */
export interface I18nCoverageView {
    /** One entry per configured locale, in config order. */
    locales: LocaleCoverageView[];
    /** Translation groups across every localized type. */
    records: number;
    /** Records that exist in **every** configured locale. */
    localized: number;
    /**
     * Records that exist in exactly one locale — nothing translated yet.
     *
     * Always `0` when the deployment configures a single locale: there is
     * nowhere to translate to, so every record would otherwise be reported as
     * both fully localized and not localized at all.
     */
    notLocalized: number;
    /** Records missing at least one configured locale (`records - localized`). */
    requiresLocalization: number;
    /**
     * Per-type coverage, most records first.
     *
     * A type the workspace has never used is **omitted** rather than listed at
     * zero — the same rule the content pipeline applies. A permanently empty row
     * is noise on a chart about where the outstanding work sits, and it would
     * push the types that do hold work further down the list.
     */
    types: ContentTypeCoverageView[];
}
