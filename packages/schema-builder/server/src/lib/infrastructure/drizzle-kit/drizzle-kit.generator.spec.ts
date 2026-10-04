import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stageFiles } from '@orthacms/schema-builder-domain';
import { documentOf, typeOf, withField } from '../../../testing/documents';
import {
    MigrationAmbiguityError,
    MigrationGenerateError
} from '../../domain/errors';
import { NodeSourceTree } from '../source-tree/node-source-tree';
import { DrizzleKitGenerator } from './drizzle-kit.generator';

/**
 * The real, locked drizzle-kit. Pins the three facts the generator depends on
 * and the docs do not promise: generated files appear under `out`, "nothing
 * to migrate" is said in words, and without a TTY a rename question fails —
 * with exit code 0 — in words `readOutcome` recognises.
 *
 * Inside the workspace (not the OS temp dir) because the staged modules import
 * `@orthacms/content-server/define`, which resolves only from in here.
 */
jest.setTimeout(60_000);

describe('DrizzleKitGenerator (integration)', () => {
    const root = join(
        __dirname,
        '../../../../test-output',
        `drizzle-kit-${randomUUID()}`
    );
    const tree = new NodeSourceTree(root);
    const generator = new DrizzleKitGenerator(root, tree, 30_000);
    const tag = typeOf('sb_dk_tag', {
        name: { type: 'text' },
        legacy: { type: 'text' }
    });

    /** Writes `doc`'s modules and manifest into `dir`, as the stage does. */
    function stage(dir: string, doc: ReturnType<typeof documentOf>) {
        for (const [path, source] of Object.entries(
            stageFiles(documentOf(), doc).write
        )) {
            mkdirSync(join(root, dir, path, '..'), { recursive: true });
            writeFileSync(join(root, dir, path), source);
        }
    }

    beforeAll(() => mkdirSync(root, { recursive: true }));
    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it('generates the SQL for a staged document into the given folder', async () => {
        stage('v1', documentOf(tag));
        const first = await generator.generate({
            schema: 'v1/index.ts',
            out: 'migrations',
            name: 'init'
        });
        expect(first.files).toEqual([
            expect.stringMatching(/^0000_init\.sql$/)
        ]);
        expect(first.sql).toContain('CREATE TABLE "content_sb_dk_tag"');
        expect(first.sql).toContain('"legacy" text');
    });

    it('answers nothing when the schema matches the snapshot', async () => {
        await expect(
            generator.generate({
                schema: 'v1/index.ts',
                out: 'migrations',
                name: 'same'
            })
        ).resolves.toEqual({
            files: [],
            sql: ''
        });
    });

    it('generates an addition on its own', async () => {
        stage('v2', documentOf(withField(tag, 'color', { type: 'text' })));
        const added = await generator.generate({
            schema: 'v2/index.ts',
            out: 'migrations',
            name: 'color'
        });
        expect(added.sql).toContain('ADD COLUMN "color" text');
    });

    it('refuses a drop and an add in one diff as ambiguous — the case the phases exist for', async () => {
        const swapped = {
            ...tag,
            fields: [
                tag.fields[0],
                {
                    key: 'sb_dk_tag.colour',
                    name: 'colour',
                    spec: { type: 'text' as const }
                }
            ]
        };
        stage('v3', documentOf(swapped));
        await expect(
            generator.generate({
                schema: 'v3/index.ts',
                out: 'migrations',
                name: 'swap'
            })
        ).rejects.toBeInstanceOf(MigrationAmbiguityError);
        await expect(tree.list('migrations')).resolves.toHaveLength(2);
    });

    it('reports a schema that does not compile, though drizzle-kit exits 0', async () => {
        mkdirSync(join(root, 'broken'), { recursive: true });
        writeFileSync(join(root, 'broken/index.ts'), 'export const x = ');
        await expect(
            generator.generate({
                schema: 'broken/index.ts',
                out: 'migrations',
                name: 'bad'
            })
        ).rejects.toBeInstanceOf(MigrationGenerateError);
    });

    it('kills a run at its deadline instead of hanging the request', async () => {
        const hurried = new DrizzleKitGenerator(root, tree, 1);
        await expect(
            hurried.generate({
                schema: 'v2/index.ts',
                out: 'migrations',
                name: 'late'
            })
        ).rejects.toThrow(MigrationGenerateError);
    });
});
