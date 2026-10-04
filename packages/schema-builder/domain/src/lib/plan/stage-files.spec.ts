import { documentOf, typeOf } from '../../testing/fixtures';
import { GENERATED_MARKER } from '../generated-marker';
import { stageFiles } from './stage-files';

describe('stageFiles', () => {
    const owned = typeOf('event', { title: { type: 'text' } });
    const hand = typeOf(
        'article',
        { title: { type: 'text' } },
        { origin: 'code' }
    );
    const page = typeOf(
        'home',
        { headline: { type: 'text' } },
        { kind: 'single' }
    );

    it('writes every builder-owned type and the manifest, never a hand-written file', () => {
        const { write, remove } = stageFiles(
            documentOf(owned, hand),
            documentOf(owned, hand, page)
        );
        expect(Object.keys(write).sort()).toEqual([
            'collections/event.ts',
            'index.ts',
            'pages/home.ts'
        ]);
        expect(write['collections/event.ts'].startsWith(GENERATED_MARKER)).toBe(
            true
        );
        expect(remove).toEqual([]);
    });

    it('lists every type, hand-written ones included, in the manifest', () => {
        const { write } = stageFiles(
            documentOf(owned, hand),
            documentOf(owned, hand)
        );
        expect(write['index.ts']).toContain("from './collections/article'");
        expect(write['index.ts']).toContain("from './collections/event'");
    });

    it('deletes the file of a builder-owned type that is gone', () => {
        const { write, remove } = stageFiles(
            documentOf(owned, page, hand),
            documentOf(hand)
        );
        expect(remove).toEqual(['collections/event.ts', 'pages/home.ts']);
        expect(write['index.ts']).not.toContain('event');
    });

    it('never deletes a hand-written file, even when its type is gone', () => {
        expect(stageFiles(documentOf(hand), documentOf()).remove).toEqual([]);
    });
});
