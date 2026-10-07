import type { OwningRelationDoc } from '@orthacms/schema-builder-domain';

/**
 * What the author picks: follow the link into the other locales, or leave each
 * locale's links to itself. The DSL has one boolean for it —
 * `syncAcrossLocales`, with `localized: true` as its alias for `false`.
 */
export type LocaleSyncChoice = 'sync' | 'separate';

/** Every choice the picker offers, in the order it offers them. */
export const LOCALE_SYNC_CHOICES: readonly LocaleSyncChoice[] = [
    'sync',
    'separate'
];

/**
 * What the choice does once the target is known — the same three modes as
 * content-server's `relationLocaleSync`. `sync` splits on the **target**: a
 * link to untranslated content is one row for every locale (`shared`), a link
 * to translated content names that content's row in each sibling's own locale
 * (`mirrored`). It is not a third option; the author cannot pick it.
 */
export type RelationLocaleMode = 'shared' | 'mirrored' | 'separate';

type LocaleFlags = Pick<OwningRelationDoc, 'syncAcrossLocales'> & {
    localized?: boolean;
};

/** The choice a relation's flags mean — `syncAcrossLocales` defaults to the opposite of `localized`. */
export function localeSyncChoiceOf(relation: LocaleFlags): LocaleSyncChoice {
    return (relation.syncAcrossLocales ?? !relation.localized)
        ? 'sync'
        : 'separate';
}

/**
 * The flags a choice means. Each answer sets both, so a relation never ends up
 * `localized` and synced at once (the kernel rejects that): `sync` is the DSL
 * default and leaves both unset; `separate` writes only the opt-out.
 */
export function toLocaleSyncFlags(
    choice: LocaleSyncChoice
): Record<'syncAcrossLocales' | 'localized', boolean | undefined> {
    return choice === 'sync'
        ? { syncAcrossLocales: undefined, localized: undefined }
        : { syncAcrossLocales: false, localized: undefined };
}

/** What `choice` does for a relation whose target is (or is not) translated. */
export function relationLocaleMode(
    choice: LocaleSyncChoice,
    targetI18n: boolean
): RelationLocaleMode {
    if (choice === 'separate') return 'separate';
    return targetI18n ? 'mirrored' : 'shared';
}
