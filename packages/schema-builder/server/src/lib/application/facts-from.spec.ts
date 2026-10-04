import { documentOf, typeOf } from '../../testing/documents';
import { factsFrom } from './facts-from';

describe('factsFrom', () => {
    const after = documentOf(
        typeOf('tag', {
            name: { type: 'text' },
            parent: { type: 'relation', to: 'tag' }
        }),
        typeOf('post', { tags: { type: 'relation', to: 'tag', many: true } }),
        typeOf('page', { title: { type: 'text' } })
    );
    const facts = factsFrom(
        new Map([['tag', 3]]),
        new Map([['tag', 2]]),
        after
    );

    it('answers the counts it was given, and zero for any other type', () => {
        expect(facts.rows('tag')).toBe(3);
        expect(facts.grantedTo('tag')).toBe(2);
        expect(facts.rows('post')).toBe(0);
        expect(facts.grantedTo('new_type')).toBe(0);
    });

    it('finds references in the document being applied, a self-relation excluded', () => {
        expect(facts.referencedBy('tag')).toEqual(['post']);
        expect(facts.referencedBy('page')).toEqual([]);
    });
});
