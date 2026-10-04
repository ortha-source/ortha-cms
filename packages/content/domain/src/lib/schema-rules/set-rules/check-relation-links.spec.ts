import type { RuleField, RuleType } from '../rule-type';
import { checkRelationLinks } from './check-relation-links';

const rel = (
    to: string,
    over: Partial<NonNullable<RuleField['relation']>> = {}
): RuleField => ({
    type: 'relation',
    required: false,
    relation: {
        to,
        many: false,
        unique: false,
        onDelete: 'set null',
        syncAcrossLocales: true,
        ...over
    }
});
const type = (name: string, fields: Record<string, RuleField>): RuleType => ({
    name,
    kind: 'collection',
    i18n: false,
    fields
});

describe('checkRelationLinks', () => {
    const author = type('author', {
        posts: rel('post', { many: true, inverse: { field: 'author' } })
    });

    it('accepts a target that exists and an inverse that mirrors back', () => {
        expect(
            checkRelationLinks([
                type('post', { author: rel('author') }),
                author
            ])
        ).toEqual([]);
    });

    it('rejects an unregistered target', () => {
        const [found] = checkRelationLinks([
            type('post', { author: rel('writer') })
        ]);
        expect(found.message).toBe(
            'Relation "post.author" targets "writer", which is not registered with ContentPlugin.'
        );
    });

    it('rejects an inverse naming a field that does not own storage', () => {
        const [found] = checkRelationLinks([
            type('post', { title: { type: 'text', required: false } }),
            author
        ]);
        expect(found.code).toBe('relation.inverse-not-owning');
        expect(found.message).toBe(
            'Inverse relation "author.posts" references "post.author", which is not a storage-owning relation field.'
        );
    });

    it('rejects an inverse whose owner points elsewhere', () => {
        const [found] = checkRelationLinks([
            type('post', { author: rel('editor') }),
            type('editor', {}),
            author
        ]);
        expect(found.message).toBe(
            'Inverse relation "author.posts" mirrors "post.author", but that field targets "editor", not "author".'
        );
    });

    it('reads `to` only here, so a lazy target is resolved after every type exists', () => {
        let resolved = false;
        const lazy: RuleField = {
            type: 'relation',
            required: false,
            relation: {
                get to() {
                    resolved = true;
                    return 'author';
                },
                many: false,
                unique: false,
                onDelete: 'set null',
                syncAcrossLocales: true
            }
        };
        checkRelationLinks([
            type('post', { author: lazy }),
            type('author', {})
        ]);
        expect(resolved).toBe(true);
    });
});
