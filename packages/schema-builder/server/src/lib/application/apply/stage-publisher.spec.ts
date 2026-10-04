import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { StagePublisher } from './stage-publisher';

describe('StagePublisher [schema-builder:I-04]', () => {
    it('writes what changed and deletes what went, under src/content only', async () => {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'old manifest',
            'src/content/collections/legacy.ts': 'legacy',
            'src/content/collections/hand.ts': 'hand-written'
        });
        await new StagePublisher(tree, {
            enabled: true,
            production: false,
            projectRoot: '/app'
        }).publish([
            { path: 'index.ts', before: 'old manifest', after: 'new manifest' },
            { path: 'collections/event.ts', before: null, after: 'event' },
            { path: 'collections/legacy.ts', before: 'legacy', after: null }
        ]);
        expect(tree.files).toEqual({
            'src/content/index.ts': 'new manifest',
            'src/content/collections/event.ts': 'event',
            'src/content/collections/hand.ts': 'hand-written'
        });
    });
});
