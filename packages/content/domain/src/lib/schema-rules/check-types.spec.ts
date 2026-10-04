import { checkTypes } from './check-types';
import type { RuleType } from './rule-type';

describe('checkTypes — a whole schema held as data', () => {
    const post: RuleType = {
        name: 'post',
        kind: 'collection',
        i18n: false,
        fields: {
            slug: { type: 'text', required: true, pattern: '(' },
            author: {
                type: 'relation',
                required: false,
                relation: {
                    to: 'writer',
                    many: false,
                    unique: false,
                    onDelete: 'set null',
                    syncAcrossLocales: true
                }
            }
        }
    };

    it('reports type rules, option rules and set rules together', () => {
        expect(checkTypes([post, post]).map((i) => i.code)).toEqual([
            'field.pattern',
            'field.pattern',
            'type.duplicate',
            'relation.unknown-target',
            'relation.unknown-target'
        ]);
    });

    it('is empty for a valid schema', () => {
        const author: RuleType = {
            name: 'writer',
            kind: 'collection',
            i18n: false,
            fields: { name: { type: 'text', required: true } }
        };
        const fixed: RuleType = {
            ...post,
            fields: {
                ...post.fields,
                slug: { type: 'text', required: true, pattern: '^[a-z]+$' }
            }
        };
        expect(checkTypes([fixed, author])).toEqual([]);
    });
});
