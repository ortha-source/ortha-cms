import type { RuleRelation } from '../rule-type';
import { checkRequiredSetNull } from './check-required-set-null';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'post',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};
const relation = (required: boolean, over: Partial<RuleRelation> = {}) => ({
    type: 'relation',
    required,
    relation: {
        to: 'author',
        many: false,
        unique: false,
        onDelete: 'set null' as const,
        syncAcrossLocales: true,
        ...over
    }
});

describe('checkRequiredSetNull', () => {
    it('rejects a required single relation that nulls on delete', () => {
        const [found] = checkRequiredSetNull(
            type,
            'author',
            relation(true),
            pass
        );
        expect(found.message).toBe(
            "Relation \"post.author\" is required but its onDelete is 'set null' — a NOT NULL foreign key cannot be nulled on delete. Use 'cascade' or 'restrict'."
        );
    });

    it.each([
        ['optional', relation(false)],
        ['cascade', relation(true, { onDelete: 'cascade' })],
        ['many', relation(true, { many: true })],
        ['inverse', relation(true, { inverse: { field: 'posts' } })]
    ])('accepts %s', (_, field) => {
        expect(checkRequiredSetNull(type, 'author', field, pass)).toEqual([]);
    });
});
