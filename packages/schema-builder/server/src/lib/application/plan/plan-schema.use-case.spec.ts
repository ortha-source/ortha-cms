import type { SchemaDocumentEnvelope } from '@orthacms/schema-builder-domain';
import {
    documentOf,
    envelopeOf,
    typeOf,
    withField
} from '../../../testing/documents';
import {
    passThroughFormatter,
    RecordingGenerator,
    statsOf
} from '../../../testing/fakes';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import { InvalidDocumentError } from '../../domain/errors';
import { ChangePlanner } from '../change-planner';
import type { LoadDocumentUseCase } from '../load-document.use-case';
import { StageWriter } from '../stage/stage-writer';
import { PlanSchemaUseCase } from './plan-schema.use-case';
import { MigrationPhases } from '../migrations/migration-phases';
import { PreviewMigration } from './preview-migration';

describe('PlanSchemaUseCase', () => {
    const tag = typeOf(
        'tag',
        { name: { type: 'text' } },
        { publishable: false }
    );
    const current = envelopeOf(documentOf(tag));
    const config = { enabled: true, production: false, projectRoot: '/app' };

    function setup(
        envelope: SchemaDocumentEnvelope = current,
        rows: Record<string, number> = {}
    ) {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'manifest',
            'src/content/collections/tag.ts': 'tag'
        });
        const generator = new RecordingGenerator();
        const stage = new StageWriter(tree, passThroughFormatter, config);
        const load = { execute: async () => envelope } as LoadDocumentUseCase;
        const useCase = new PlanSchemaUseCase(
            load,
            new ChangePlanner(statsOf(rows)),
            stage,
            new PreviewMigration(
                tree,
                config,
                new MigrationPhases(generator, stage)
            ),
            tree
        );
        return { tree, generator, useCase };
    }

    it('answers the changes, the changed files and the SQL', async () => {
        const { useCase } = setup();
        const plan = await useCase.execute(
            documentOf(withField(tag, 'color', { type: 'text' })),
            current.fingerprint
        );
        expect(plan.baseFingerprint).toBe(current.fingerprint);
        expect(plan.blocked).toBe(false);
        expect(plan.changes.map((change) => change.id)).toEqual([
            'field.add:tag.color'
        ]);
        expect(plan.files.map((file) => file.path)).toEqual([
            'collections/tag.ts',
            'index.ts'
        ]);
        expect(plan.sql).toEqual(['-- schema_builder']);
    });

    it('generates no SQL for a code-only change', async () => {
        const { useCase, generator } = setup();
        const plan = await useCase.execute(
            documentOf({ ...tag, label: 'Tags' }),
            current.fingerprint
        );
        expect(plan.sql).toEqual([]);
        expect(generator.runs).toEqual([]);
        expect(plan.files.map((file) => file.path)).toEqual([
            'collections/tag.ts',
            'index.ts'
        ]);
    });

    it('answers a blocked draft with its verdicts and nothing staged', async () => {
        const { useCase, generator, tree } = setup(current, { tag: 3 });
        const plan = await useCase.execute(
            documentOf(
                withField(tag, 'code', { type: 'text', required: true })
            ),
            current.fingerprint
        );
        expect(plan).toMatchObject({ blocked: true, files: [], sql: [] });
        expect(plan.changes[0].safety).toBe('blocked');
        expect(generator.runs).toEqual([]);
        expect(
            Object.keys(tree.files).some((path) => path.startsWith('.orthacms'))
        ).toBe(false);
    });

    it('removes its scratch folder, also when the generator fails', async () => {
        const { useCase, generator, tree } = setup();
        generator.generate = async () => {
            throw new Error('drizzle-kit fell over');
        };
        await expect(
            useCase.execute(
                documentOf(withField(tag, 'color', { type: 'text' })),
                current.fingerprint
            )
        ).rejects.toThrow('drizzle-kit fell over');
        expect(
            Object.keys(tree.files).some((path) => path.startsWith('.orthacms'))
        ).toBe(false);
    });

    it('refuses a body that is not a document before reading anything', async () => {
        const { useCase } = setup();
        await expect(
            useCase.execute({ version: 1, types: 'all' }, current.fingerprint)
        ).rejects.toBeInstanceOf(InvalidDocumentError);
    });
});
