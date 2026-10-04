import { documentOf, typeOf } from '../../testing/fixtures';
import { diffDocuments } from './diff-documents';

describe('diffDocuments', () => {
    const tag = typeOf('tag', { name: { type: 'text' } });
    const event = typeOf('event', { title: { type: 'text' } });
    const author = typeOf('author', { name: { type: 'text' } });

    it('lists removed types, then changes inside kept types, then added types', () => {
        const before = documentOf(tag, author);
        const after = documentOf({ ...tag, label: 'Tags' }, event);
        expect(diffDocuments(before, after)).toEqual([
            { kind: 'type.remove', type: 'author' },
            { kind: 'type.meta', type: 'tag', keys: ['label'] },
            { kind: 'type.add', type: 'event' }
        ]);
    });

    it('does not care about the order of types', () => {
        expect(
            diffDocuments(documentOf(tag, event), documentOf(event, tag))
        ).toEqual([]);
    });
});
