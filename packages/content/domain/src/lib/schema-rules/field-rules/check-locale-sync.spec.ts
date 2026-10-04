import type { RuleField, RuleRelation } from '../rule-type';
import { checkLocaleSync } from './check-locale-sync';

const pass = { columns: new Map<string, string>() };
const type = (i18n: boolean) => ({
    name: 'post',
    kind: 'collection' as const,
    i18n,
    fields: {}
});
const relation = (
    over: Partial<RuleRelation>,
    field: Partial<RuleField> = {}
): RuleField => ({
    type: 'relation',
    required: false,
    ...field,
    relation: {
        to: 'tag',
        many: true,
        unique: false,
        onDelete: 'set null',
        syncAcrossLocales: true,
        ...over
    }
});

describe('checkLocaleSync', () => {
    it('accepts the default on any type', () => {
        expect(
            checkLocaleSync(type(false), 'tags', relation({}), pass)
        ).toEqual([]);
        expect(checkLocaleSync(type(true), 'tags', relation({}), pass)).toEqual(
            []
        );
    });

    it('rejects an explicit syncAcrossLocales: false on a type without i18n', () => {
        const [found] = checkLocaleSync(
            type(false),
            'tags',
            relation({ syncAcrossLocales: false }),
            pass
        );
        expect(found.code).toBe('relation.sync-without-i18n');
        expect(found.message).toBe(
            'Relation "post.tags" sets syncAcrossLocales, but "post" does not set i18n: true — it has no locale siblings to propagate to.'
        );
    });

    it('rejects localized together with syncAcrossLocales: true', () => {
        const [found] = checkLocaleSync(
            type(true),
            'tags',
            relation({ syncAcrossLocales: true }, { localized: true }),
            pass
        );
        expect(found.code).toBe('relation.localized-sync');
    });

    it('ignores an inverse, which owns no storage', () => {
        expect(
            checkLocaleSync(
                type(false),
                'posts',
                relation({
                    syncAcrossLocales: false,
                    inverse: { field: 'tags' }
                }),
                pass
            )
        ).toEqual([]);
    });
});
