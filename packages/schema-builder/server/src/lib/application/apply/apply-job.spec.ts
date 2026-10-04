import { documentOf, typeOf, withField } from '../../../testing/documents';
import {
    MemoryOperationLog,
    passThroughFormatter,
    RecordingGenerator
} from '../../../testing/fakes';
import { MemorySourceTree } from '../../../testing/memory-source-tree';
import type { ApplyOperation } from '@orthacms/schema-builder-domain';
import type { ChangePlan } from '../change-planner';
import { MigrationPhases } from '../migrations/migration-phases';
import { StageWriter } from '../stage/stage-writer';
import { MigrationAmbiguityError } from '../../domain/errors';
import { ApplyJob } from './apply-job';
import { StagePublisher } from './stage-publisher';

describe('ApplyJob', () => {
    const tag = typeOf('tag', { name: { type: 'text' } });
    const current = documentOf(tag);
    const draft = documentOf(withField(tag, 'color', { type: 'text' }));
    const config = { enabled: true, production: false, projectRoot: '/app' };
    const operation: ApplyOperation = {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'running',
        step: 'generate',
        migrations: [],
        files: [],
        bootId: 'boot',
        startedAt: '2026-01-01T00:00:00.000Z'
    };
    const plan = (needsMigration = true): ChangePlan => ({
        changes: [],
        blocked: false,
        needsMigration
    });

    function setup() {
        const tree = new MemorySourceTree({
            'src/content/index.ts': 'old manifest',
            'src/content/collections/tag.ts': 'old tag',
            'migrations/0000_init.sql': 'CREATE TABLE',
            'migrations/meta/_journal.json': '{"entries":[0]}'
        });
        const generator = new RecordingGenerator();
        // Like drizzle-kit: the new migration lands in the real folder, and the journal changes.
        generator.generate = async (input) => {
            generator.runs.push(input);
            await tree.write(
                `${input.out}/0001_${input.name}.sql`,
                'ALTER TABLE'
            );
            await tree.write(
                `${input.out}/meta/_journal.json`,
                '{"entries":[0,1]}'
            );
            return { files: [`0001_${input.name}.sql`], sql: 'ALTER TABLE' };
        };
        const events: string[] = [];
        const runner = {
            run: jest.fn(async () => void events.push('migrate'))
        };
        const audit = {
            applied: jest.fn(async () => void events.push('audit'))
        };
        const log = new MemoryOperationLog();
        const stage = new StageWriter(tree, passThroughFormatter, config);
        const publisher = new StagePublisher(tree, config);
        const publish = jest
            .spyOn(publisher, 'publish')
            .mockImplementation(async (files) => {
                events.push('publish');
                return StagePublisher.prototype.publish.call(publisher, files);
            });
        const job = new ApplyJob(
            tree,
            config,
            log,
            runner,
            audit,
            stage,
            new MigrationPhases(generator, stage),
            publisher
        );
        const release = jest.fn(async () => void events.push('release'));
        const run = (needsMigration = true) =>
            job.run({
                operation,
                current,
                draft,
                plan: plan(needsMigration),
                migrationName: 'add_color',
                actorId: 'u1',
                release
            });
        return {
            tree,
            generator,
            runner,
            audit,
            log,
            publish,
            release,
            events,
            run
        };
    }

    it('generates, migrates, records and only then publishes — then releases the lock', async () => {
        const { tree, events, log, run } = setup();
        const done = await run();
        expect(events).toEqual(['migrate', 'audit', 'publish', 'release']);
        expect(done).toMatchObject({
            status: 'succeeded',
            step: null,
            migrations: ['0001_add_color.sql']
        });
        expect(done.files).toEqual(['collections/tag.ts', 'index.ts']);
        expect(log.history.map((saved) => [saved.status, saved.step])).toEqual([
            ['running', 'migrate'],
            ['running', 'publish'],
            ['succeeded', null]
        ]);
        expect(tree.files['src/content/collections/tag.ts']).toContain(
            'color: field.text()'
        );
        expect(
            Object.keys(tree.files).some((path) =>
                path.startsWith('.orthacms/apply')
            )
        ).toBe(false);
    });

    it('records what it did: the operation, the actor, the migrations and the files', async () => {
        const { audit, run } = setup();
        await run();
        expect(audit.applied).toHaveBeenCalledWith({
            operationId: operation.id,
            actorId: 'u1',
            changes: [],
            migrations: ['0001_add_color.sql'],
            files: ['collections/tag.ts', 'index.ts']
        });
    });

    it('skips drizzle-kit and the migrator for a code-only change', async () => {
        const { generator, runner, run } = setup();
        const done = await run(false);
        expect(generator.runs).toEqual([]);
        expect(runner.run).not.toHaveBeenCalled();
        expect(done.status).toBe('succeeded');
    });

    it('puts the migrations folder back and writes no source when the migration fails [schema-builder:I-03]', async () => {
        const { tree, runner, publish, release, run } = setup();
        runner.run.mockRejectedValueOnce(new Error('relation already exists'));
        const done = await run();
        expect(done).toMatchObject({
            status: 'failed',
            step: 'migrate',
            migrations: []
        });
        expect(done.error).toEqual({
            code: 'schema-builder.apply-failed',
            message: 'relation already exists'
        });
        expect(tree.files['migrations/0001_add_color.sql']).toBeUndefined();
        expect(tree.files['migrations/meta/_journal.json']).toBe(
            '{"entries":[0]}'
        );
        expect(tree.files['src/content/collections/tag.ts']).toBe('old tag');
        expect(publish).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('keeps its stable code when drizzle-kit refuses, and still releases', async () => {
        const { generator, release, run } = setup();
        generator.generate = async () => {
            throw new MigrationAmbiguityError('rename?');
        };
        const done = await run();
        expect(done).toMatchObject({ status: 'failed', step: 'generate' });
        expect(done.error?.code).toBe('schema-builder.migration-ambiguous');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('keeps the backup when the files cannot be written after the commit — the database moved', async () => {
        const { tree, publish, run } = setup();
        publish.mockRejectedValueOnce(new Error('EACCES'));
        const done = await run();
        expect(done).toMatchObject({
            status: 'failed',
            step: 'publish',
            migrations: ['0001_add_color.sql']
        });
        expect(done.error?.code).toBe('schema-builder.publish-failed');
        expect(tree.files['migrations/0001_add_color.sql']).toBe('ALTER TABLE');
        expect(
            tree.files[
                `.orthacms/apply/${operation.id}/backup/content/collections/tag.ts`
            ]
        ).toBe('old tag');
    });

    it('still succeeds when the audit cannot be written — the schema did change', async () => {
        const { audit, run } = setup();
        audit.applied.mockRejectedValueOnce(new Error('outbox down'));
        await expect(run()).resolves.toMatchObject({ status: 'succeeded' });
    });
});
