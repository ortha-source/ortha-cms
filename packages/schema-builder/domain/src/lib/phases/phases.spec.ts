import { documentOf, fieldOf, typeOf } from '../../testing/fixtures';
import { hasRemovals } from './has-removals';
import { withoutAdditions } from './without-additions';

describe('the two apply phases', () => {
    const tag = typeOf(
        'tag',
        {
            name: { type: 'text' },
            legacy: { type: 'text', admin: { group: 'old' } }
        },
        { groups: [{ key: 'old', label: 'Old' }] }
    );
    const author = typeOf('author', { name: { type: 'text' } });
    const before = documentOf(tag, author);
    const after = documentOf(
        {
            ...tag,
            groups: [],
            fields: [
                { ...tag.fields[0], spec: { type: 'text', maxLength: 40 } },
                fieldOf('tag', 'color', { type: 'text' })
            ]
        },
        typeOf('event', { title: { type: 'text' } })
    );

    it('keeps only the removals: no additions, no updates, no new types', () => {
        const removals = withoutAdditions(before, after);
        expect(removals.types.map((type) => type.name)).toEqual(['tag']);
        expect(removals.types[0].fields).toEqual([tag.fields[0]]);
    });

    it('drops a group whose last field was removed, so the stage still compiles', () => {
        expect(withoutAdditions(before, after).types[0].groups).toEqual([]);
    });

    it('knows whether there is anything to remove', () => {
        expect(hasRemovals(before, after)).toBe(true);
        expect(hasRemovals(after, after)).toBe(false);
        expect(hasRemovals(documentOf(author), documentOf(author, tag))).toBe(
            false
        );
    });
});
