/**
 * Wire contracts of the i18n server plugin, as the admin sees them. Mirrors
 * `@ortha-cms/i18n-server`'s views without importing across the server
 * boundary (the workspace convention for wire types).
 */

import type { EntryStatus } from '@ortha-cms/content-admin';

/** One configured locale, served by `GET /api/i18n/locales`. */
export type Locale = {
    /** Stable machine slug stored on entry rows (e.g. `en`, `pt-br`). */
    slug: string;
    /** Human display name. */
    name: string;
    /** Whether it's the default locale (exactly one is). */
    isDefault: boolean;
};

/** The `GET /api/i18n/locales` envelope. */
export type LocalesResult = {
    items: Locale[];
};

/** One locale's slot in an entry's translation group. */
export type EntryLocaleItem = {
    locale: string;
    isDefault: boolean;
    /** The group's row in this locale, or null when not yet translated. */
    entry: {
        id: string;
        /** Publish state — publishable types only. */
        status?: EntryStatus;
        /**
         * When this locale last went live, or `null` if never — publishable
         * types only. With `status` it names the four states the switcher
         * renders (see content-admin's `entryStatusView`): a `draft` that has a
         * `publishedAt` is *modified*, not a plain draft.
         */
        publishedAt?: string | null;
        /** ISO last-updated timestamp. */
        updatedAt: string;
    } | null;
};

/** The `GET /api/i18n/content/:type/:id/locales` envelope. */
export type EntryLocalesResult = {
    localeGroupId: string;
    /** One item per configured locale, in config order. */
    items: EntryLocaleItem[];
};

/** One live group member in a batched locale summary. */
export type LocaleSummaryItem = {
    locale: string;
    entryId: string;
    /** Publish state — publishable types only. */
    status?: EntryStatus;
    /** When this locale last went live, or `null` — publishable types only. */
    publishedAt?: string | null;
};

/** The `POST /api/i18n/content/:type/locale-summary` envelope. */
export type LocaleSummariesResult = {
    /** Per requested group id: its live members, config-ordered. */
    groups: Record<string, LocaleSummaryItem[]>;
};
