import { checkTypes } from '@orthacms/content-domain';
import { typeOf } from '../../testing/fixtures';
import { toRuleField } from './to-rule-field';
import { toRuleRelation } from './to-rule-relation';
import { toRuleType } from './to-rule-type';

describe('toRuleRelation — the DSL defaults', () => {
    it('defaults onDelete to cascade when required and set null otherwise', () => {
        expect(
            toRuleRelation({ type: 'relation', to: 'author', required: true })
                .onDelete
        ).toBe('cascade');
        expect(
            toRuleRelation({ type: 'relation', to: 'author' }).onDelete
        ).toBe('set null');
    });

    it('defaults syncAcrossLocales to the opposite of localized', () => {
        expect(
            toRuleRelation({ type: 'relation', to: 'tag' }).syncAcrossLocales
        ).toBe(true);
        expect(
            toRuleRelation({ type: 'relation', to: 'tag', localized: true })
                .syncAcrossLocales
        ).toBe(false);
    });

    it('reads an inverse as a to-many back-reference with no storage options', () => {
        expect(
            toRuleRelation({
                type: 'relation',
                to: 'post',
                inverseOf: 'author'
            })
        ).toEqual({
            to: 'post',
            many: true,
            unique: false,
            onDelete: 'set null',
            syncAcrossLocales: false,
            inverse: { field: 'author' }
        });
    });
});

describe('toRuleField', () => {
    it('carries what the rules read', () => {
        expect(
            toRuleField({
                type: 'text',
                required: true,
                lang: 'de',
                pattern: '^a$',
                admin: { width: 'half', group: 'seo', label: 'X' }
            })
        ).toEqual({
            type: 'text',
            required: true,
            lang: 'de',
            pattern: '^a$',
            width: 'half',
            group: 'seo'
        });
    });
});

describe('toRuleType', () => {
    it('lets the kernel judge a document the way it judges the DSL', () => {
        const post = typeOf(
            'post',
            {
                status: { type: 'text' },
                author: { type: 'relation', to: 'writer' }
            },
            { groups: [{ key: 'seo', label: 'SEO' }] }
        );
        expect(
            checkTypes([toRuleType(post)]).map((issue) => issue.code)
        ).toEqual([
            'field.reserved-column',
            'group.empty',
            'relation.unknown-target'
        ]);
    });
});
