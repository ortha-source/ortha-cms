import { documentOf, typeOf, withField } from '../../../testing/documents';
import {
    passThroughFormatter,
    RecordingGenerator
} from '../../../testing/fakes';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { StageWriter } from '../stage/stage-writer';
import { PreviewMigration } from './preview-migration';

describe('PreviewMigration', () => {
    const tag = typeOf('tag', {
        name: { type: 'text' },
        legacy: { type: 'text' }
    });
    const current = documentOf(tag);
    const config = { enabled: true, production: false, projectRoot: '/app' };

    function setup() {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'manifest',
            'migrations/0000_init.sql': 'CREATE TABLE …',
            'migrations/meta/_journal.json': '{}'
        });
        const generator = new RecordingGenerator();
        const preview = new PreviewMigration(
            tree,
            generator,
            config,
            new StageWriter(tree, passThroughFormatter, config)
        );
        return { tree, generator, preview };
    }

    it('generates into a copy of the migrations folder, never the real one', async () => {
        const { tree, generator, preview } = setup();
        await preview.run(
            '.orthacms/plan/x',
            current,
            documentOf(withField(tag, 'color', { type: 'text' }))
        );
        expect(generator.runs.map((run) => run.out)).toEqual([
            '.orthacms/plan/x/migrations'
        ]);
        expect(tree.files['.orthacms/plan/x/migrations/0000_init.sql']).toBe(
            'CREATE TABLE …'
        );
        expect(
            Object.keys(tree.files).filter((path) =>
                path.startsWith('migrations/')
            )
        ).toHaveLength(2);
    });

    it('runs once, against the staged draft, when nothing is removed', async () => {
        const { generator, preview } = setup();
        const sql = await preview.run(
            '.orthacms/plan/x',
            current,
            documentOf(withField(tag, 'color', { type: 'text' }))
        );
        expect(generator.runs.map((run) => run.schema)).toEqual([
            '.orthacms/plan/x/content/index.ts'
        ]);
        expect(sql).toEqual(['-- schema_builder_changes']);
    });

    it('runs the removals first when something is removed — no diff holds a drop and an add', async () => {
        const { tree, generator, preview } = setup();
        const draft = documentOf({
            ...withField(tag, 'color', { type: 'text' }),
            fields: [
                tag.fields[0],
                withField(tag, 'color', { type: 'text' }).fields[2]
            ]
        });
        const sql = await preview.run('.orthacms/plan/x', current, draft);
        expect(generator.runs.map((run) => run.schema)).toEqual([
            '.orthacms/plan/x/removals/index.ts',
            '.orthacms/plan/x/content/index.ts'
        ]);
        expect(sql).toEqual([
            '-- schema_builder_removals',
            '-- schema_builder_changes'
        ]);
        // The removals stage has the field gone and nothing added.
        expect(
            tree.files['.orthacms/plan/x/removals/collections/tag.ts']
        ).not.toContain('legacy');
        expect(
            tree.files['.orthacms/plan/x/removals/collections/tag.ts']
        ).not.toContain('color');
    });
});
