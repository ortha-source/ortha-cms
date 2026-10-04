import { documentOf, typeOf, withField } from '../../../testing/documents';
import { passThroughFormatter } from '../../../testing/fakes';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { StageWriter } from './stage-writer';

describe('StageWriter', () => {
    const event = typeOf('event', { title: { type: 'text' } });
    const hand = typeOf(
        'article',
        { title: { type: 'text' } },
        { origin: 'code' }
    );
    const old = typeOf('legacy', { name: { type: 'text' } });
    const current = documentOf(event, hand, old);
    const config = { enabled: true, production: false, projectRoot: '/app' };

    function setup() {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'old manifest',
            'src/content/collections/event.ts': 'old event',
            'src/content/collections/article.ts': 'hand-written article',
            'src/content/collections/legacy.ts': 'old legacy',
            '.orthacms/plan/x/stale.ts': 'left over'
        });
        return {
            tree,
            writer: new StageWriter(tree, passThroughFormatter, config)
        };
    }

    it('mirrors src/content into the stage, then writes what the builder owns, formatted', async () => {
        const { tree, writer } = setup();
        await writer.write(
            '.orthacms/plan/x',
            current,
            documentOf(withField(event, 'notes', { type: 'text' }), hand, old)
        );
        expect(tree.files['.orthacms/plan/x/collections/article.ts']).toBe(
            'hand-written article'
        );
        expect(tree.files['.orthacms/plan/x/collections/event.ts']).toContain(
            'notes: field.text()'
        );
        expect(
            tree.files['.orthacms/plan/x/collections/event.ts'].endsWith(
                '// formatted'
            )
        ).toBe(true);
        expect(tree.files['.orthacms/plan/x/stale.ts']).toBeUndefined();
    });

    it('never writes under src/', async () => {
        const { tree, writer } = setup();
        const before = Object.fromEntries(
            Object.entries(tree.files).filter(([path]) =>
                path.startsWith('src/')
            )
        );
        await writer.write(
            '.orthacms/plan/x',
            current,
            documentOf(event, hand)
        );
        expect(
            Object.fromEntries(
                Object.entries(tree.files).filter(([path]) =>
                    path.startsWith('src/')
                )
            )
        ).toEqual(before);
    });

    it('answers only the files that differ, deletions included, sorted by path', async () => {
        const { writer } = setup();
        const files = await writer.write(
            '.orthacms/plan/x',
            current,
            documentOf(event, hand)
        );
        expect(
            files.map((file) => [
                file.path,
                file.before,
                file.after === null ? null : 'new'
            ])
        ).toEqual([
            ['collections/event.ts', 'old event', 'new'],
            ['collections/legacy.ts', 'old legacy', null],
            ['index.ts', 'old manifest', 'new']
        ]);
    });

    it('deletes a removed builder-owned type from the stage', async () => {
        const { tree, writer } = setup();
        await writer.write(
            '.orthacms/plan/x',
            current,
            documentOf(event, hand)
        );
        expect(
            tree.files['.orthacms/plan/x/collections/legacy.ts']
        ).toBeUndefined();
    });
});
