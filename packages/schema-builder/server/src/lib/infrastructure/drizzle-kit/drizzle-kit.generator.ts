import {
    MigrationAmbiguityError,
    MigrationGenerateError
} from '../../domain/errors';
import type {
    GeneratedMigration,
    GenerateMigrationInput,
    MigrationGenerator
} from '../../domain/ports/migration-generator.port';
import type { SourceTree } from '../../domain/ports/source-tree.port';
import { resolvePackageBin } from '../node-bin/resolve-package-bin';
import { readOutcome } from './read-outcome';
import { runDrizzleKit } from './run-drizzle-kit';

/**
 * {@link MigrationGenerator} over `drizzle-kit generate` — every line of SQL
 * the builder shows or applies is drizzle-kit's (design invariant 8). Run
 * from the project root, as the app's own `db:generate` runs it, with the
 * schema and the folder given as flags so nothing is written to configure it.
 */
export class DrizzleKitGenerator implements MigrationGenerator {
    constructor(
        private readonly root: string,
        private readonly tree: SourceTree,
        private readonly timeoutMs: number
    ) {}

    async generate({
        schema,
        out,
        name
    }: GenerateMigrationInput): Promise<GeneratedMigration> {
        const before = new Set(await this.tree.list(out));
        const args = [
            'generate',
            '--dialect=postgresql',
            `--schema=${schema}`,
            `--out=${out}`,
            `--name=${name}`
        ];
        const run = await runDrizzleKit(
            resolvePackageBin(this.root, 'drizzle-kit', 'drizzle-kit'),
            this.root,
            args,
            this.timeoutMs
        );
        const files = (await this.tree.list(out)).filter(
            (file) => !before.has(file) && file.endsWith('.sql')
        );

        switch (readOutcome(run, files.length)) {
            case 'generated': {
                const sql = await Promise.all(
                    files.map(
                        async (file) =>
                            (await this.tree.read(`${out}/${file}`)) ?? ''
                    )
                );
                return { files, sql: sql.join('\n') };
            }
            case 'unchanged':
                return { files: [], sql: '' };
            case 'ambiguous':
                throw new MigrationAmbiguityError(run.output);
            default:
                throw new MigrationGenerateError(
                    run.timedOut
                        ? `Timed out after ${this.timeoutMs} ms.\n${run.output}`
                        : run.output
                );
        }
    }
}
