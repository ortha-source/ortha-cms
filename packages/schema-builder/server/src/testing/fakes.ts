import type { ChangeFacts } from '@orthacms/schema-builder-domain';
import type { CodeFormatter } from '../lib/domain/ports/code-formatter.port';
import type { ContentStats } from '../lib/domain/ports/content-stats.port';
import type {
    GenerateMigrationInput,
    MigrationGenerator
} from '../lib/domain/ports/migration-generator.port';

/** A formatter that leaves the source as it is, marking it so a spec can tell it ran. */
export const passThroughFormatter: CodeFormatter = {
    format: async (source) => `${source}\n// formatted`
};

/** Stats with fixed numbers per type. */
export function statsOf(
    rows: Record<string, number> = {},
    grants: Record<string, number> = {}
): ContentStats {
    return {
        facts: async (_, after): Promise<ChangeFacts> => ({
            rows: (type) => rows[type] ?? 0,
            grantedTo: (type) => grants[type] ?? 0,
            referencedBy: (type) =>
                after.types
                    .filter(
                        (other) =>
                            other.name !== type &&
                            other.fields.some(
                                (f) =>
                                    f.spec.type === 'relation' &&
                                    f.spec.to === type
                            )
                    )
                    .map((other) => other.name)
        })
    };
}

/** A generator that records each run and answers `-- <name>` as its SQL. */
export class RecordingGenerator implements MigrationGenerator {
    readonly runs: GenerateMigrationInput[] = [];

    async generate(input: GenerateMigrationInput) {
        this.runs.push(input);
        return { files: [`${input.name}.sql`], sql: `-- ${input.name}` };
    }
}
