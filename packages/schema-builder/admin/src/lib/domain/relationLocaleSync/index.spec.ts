import {
    localeSyncChoiceOf,
    relationLocaleMode,
    toLocaleSyncFlags,
    type LocaleSyncChoice
} from './index';

describe('relation locale sync', () => {
    it('reads a relation with no flags as synced, the DSL default', () => {
        expect(localeSyncChoiceOf({})).toBe('sync');
    });

    it('reads localized: true as separate — it is the alias for syncAcrossLocales: false', () => {
        expect(localeSyncChoiceOf({ localized: true })).toBe('separate');
        expect(localeSyncChoiceOf({ syncAcrossLocales: false })).toBe(
            'separate'
        );
    });

    it.each<LocaleSyncChoice>(['sync', 'separate'])(
        'round-trips %s',
        (choice) => {
            const flags = toLocaleSyncFlags(choice);
            expect(
                localeSyncChoiceOf({
                    syncAcrossLocales: flags.syncAcrossLocales,
                    localized: flags.localized
                })
            ).toBe(choice);
        }
    );

    it('clears localized either way, so the two flags never contradict', () => {
        expect(toLocaleSyncFlags('sync')).toEqual({
            syncAcrossLocales: undefined,
            localized: undefined
        });
        expect(toLocaleSyncFlags('separate')).toEqual({
            syncAcrossLocales: false,
            localized: undefined
        });
    });

    it('splits sync on the target: shared for untranslated, mirrored for translated', () => {
        expect(relationLocaleMode('sync', false)).toBe('shared');
        expect(relationLocaleMode('sync', true)).toBe('mirrored');
        expect(relationLocaleMode('separate', true)).toBe('separate');
        expect(relationLocaleMode('separate', false)).toBe('separate');
    });
});
