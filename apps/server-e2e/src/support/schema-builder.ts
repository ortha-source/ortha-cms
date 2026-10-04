import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { sql } from 'drizzle-orm';
import { getDatabase } from '@orthacms/database';
import { GENERATED_MARKER, stageFiles } from '@orthacms/schema-builder-domain';
import { toDocument } from '@orthacms/schema-builder-server';
import { testContentTypes } from './content';

/** A package's CLI, through its manifest's bin field. */
function bin(pkg: string, entry: string): string {
    let dir = dirname(createRequire(__filename).resolve(pkg));
    while (
        !readdirSync(dir).includes('package.json') ||
        !readFileSync(join(dir, 'package.json'), 'utf8').includes(
            `"name": "${pkg}"`
        )
    ) {
        dir = dirname(dir);
    }
    return join(dir, entry);
}

/**
 * A project the schema builder can edit: the harness's own content types,
 * written as the builder would write them (so every type is builder-owned),
 * formatted the way the builder formats, with a migrations folder whose
 * snapshot matches them. Returns its root.
 *
 * Inside the workspace rather than the OS temp dir: the modules import
 * `@orthacms/content-server/define`, which resolves only from in here.
 */
export async function buildSourceTree(): Promise<string> {
    const root = join(
        __dirname,
        '../../test-output',
        `schema-builder-${randomUUID()}`
    );
    const document = await toDocument(testContentTypes, async () => 'builder');
    const prettier = bin('prettier', 'bin/prettier.cjs');
    for (const [path, source] of Object.entries(
        stageFiles({ version: 1, types: [] }, document).write
    )) {
        const file = join(root, 'src/content', path);
        mkdirSync(dirname(file), { recursive: true });
        const formatted = execFileSync(
            process.execPath,
            [prettier, '--stdin-filepath', relative(root, file)],
            {
                cwd: root,
                input: source
            }
        );
        writeFileSync(file, formatted);
    }
    execFileSync(
        process.execPath,
        [
            bin('drizzle-kit', 'bin.cjs'),
            'generate',
            '--dialect=postgresql',
            '--schema=src/content/index.ts',
            '--out=migrations',
            '--name=baseline'
        ],
        { cwd: root, stdio: 'pipe' }
    );
    return root;
}

/**
 * Hands a type back to its author: drops the generated marker from its file.
 * Returns the undo, so a suite can put the tree back for the next test.
 */
export function handWrite(root: string, path: string): () => void {
    const file = join(root, 'src/content', path);
    const original = readFileSync(file, 'utf8');
    writeFileSync(
        file,
        original.replace(GENERATED_MARKER, '// written by hand')
    );
    return () => writeFileSync(file, original);
}

/** Every file under `dir`, relative to it, with its contents — to prove nothing changed. */
export function snapshotDir(dir: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (at: string) => {
        for (const entry of readdirSync(at, { withFileTypes: true })) {
            const path = join(at, entry.name);
            if (entry.isDirectory()) walk(path);
            else out[relative(dir, path)] = readFileSync(path, 'utf8');
        }
    };
    walk(dir);
    return out;
}

/** Removes a tree made by {@link buildSourceTree}. */
export const removeSourceTree = (root: string): void =>
    rmSync(root, { recursive: true, force: true });

/**
 * Records a tree's baseline migration as already applied in its own tracking
 * table: the harness database already holds those tables (global-setup
 * migrated them), so an apply must run only what it generates on top.
 */
export async function markBaselineApplied(
    root: string,
    table: string
): Promise<void> {
    const journal = JSON.parse(
        readFileSync(join(root, 'migrations/meta/_journal.json'), 'utf8')
    ) as {
        entries: { when: number; tag: string }[];
    };
    const db = getDatabase();
    await db.execute(sql.raw('CREATE SCHEMA IF NOT EXISTS drizzle'));
    await db.execute(
        sql.raw(
            `CREATE TABLE IF NOT EXISTS drizzle."${table}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`
        )
    );
    for (const entry of journal.entries) {
        await db.execute(
            sql`INSERT INTO drizzle.${sql.identifier(table)} (hash, created_at) VALUES (${entry.tag}, ${entry.when})`
        );
    }
}

/** Drops what an apply suite created: its tables and its tracking table. */
export async function dropSchemaBuilderLeftovers(
    tables: readonly string[],
    migrationTables: readonly string[]
): Promise<void> {
    const db = getDatabase();
    for (const table of tables)
        await db.execute(sql.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`));
    for (const table of migrationTables)
        await db.execute(sql.raw(`DROP TABLE IF EXISTS drizzle."${table}"`));
}

/** Whether a table exists in the harness database. */
export async function tableExists(table: string): Promise<boolean> {
    const result = await getDatabase().execute(
        sql`SELECT to_regclass(${`public.${table}`}) AS found`
    );
    return (result.rows[0] as { found: string | null }).found !== null;
}
