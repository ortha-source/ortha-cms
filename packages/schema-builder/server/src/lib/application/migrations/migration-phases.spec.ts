import { documentOf, typeOf, withField } from '../../../testing/documents';
import {
    passThroughFormatter,
    RecordingGenerator
} from '../../../testing/fakes';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { StageWriter } from '../stage/stage-writer';
import { MigrationPhases } from './migration-phases';

describe('MigrationPhases', () => {
    const tag = typeOf('tag', {
        name: { type: 'text' },
        legacy: { type: 'text' }
    });
    const config = { enabled: true, production: false, projectRoot: '/app' };

    it('names the removals after the migration, and generates into the folder it is given', async () => {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'manifest'
        });
        const generator = new RecordingGenerator();
        const phases = new MigrationPhases(
            generator,
            new StageWriter(tree, passThroughFormatter, config)
        );
        const draft = documentOf({ ...tag, fields: [tag.fields[0]] });
        const result = await phases.run({
            work: 'w',
            current: documentOf(tag),
            draft,
            out: 'migrations',
            name: 'drop_legacy'
        });
        expect(generator.runs.map((run) => [run.name, run.out])).toEqual([
            ['drop_legacy_removals', 'migrations'],
            ['drop_legacy', 'migrations']
        ]);
        expect(result.files).toEqual([
            'drop_legacy_removals.sql',
            'drop_legacy.sql'
        ]);
    });

    it('drops empty SQL from the result — a phase with nothing to say', async () => {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'manifest'
        });
        const generator = new RecordingGenerator();
        generator.generate = async (input) => {
            generator.runs.push(input);
            return { files: [], sql: '' };
        };
        const phases = new MigrationPhases(
            generator,
            new StageWriter(tree, passThroughFormatter, config)
        );
        const result = await phases.run({
            work: 'w',
            current: documentOf(tag),
            draft: documentOf(withField(tag, 'x', { type: 'text' })),
            out: 'migrations',
            name: 'n'
        });
        expect(result).toEqual({ files: [], sql: [] });
    });
});
