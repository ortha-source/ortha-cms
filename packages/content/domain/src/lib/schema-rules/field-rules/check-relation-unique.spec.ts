import type { RuleRelation } from '../rule-type';
import { checkRelationUnique } from './check-relation-unique';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'post',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};
const relation = (over: Partial<RuleRelation>) => ({
    type: 'relation',
    required: false,
    relation: {
        to: 'tag',
        many: false,
        unique: false,
        onDelete: 'set null' as const,
        syncAcrossLocales: true,
        ...over
    }
});

describe('checkRelationUnique', () => {
    it('accepts unique on a single relation and many without unique', () => {
        expect(
            checkRelationUnique(type, 'seo', relation({ unique: true }), pass)
        ).toEqual([]);
        expect(
            checkRelationUnique(type, 'tags', relation({ many: true }), pass)
        ).toEqual([]);
    });

    it('rejects unique together with many', () => {
        const [found] = checkRelationUnique(
            type,
            'tags',
            relation({ many: true, unique: true }),
            pass
        );
        expect(found).toEqual({
            path: 'post.fields.tags',
            code: 'relation.unique-many',
            message:
                'Relation "post.tags" sets unique: true with many: true — a many-relation has no FK column to constrain. Drop one of them.'
        });
    });
});
