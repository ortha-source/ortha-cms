import type {
    ApplyOperation,
    ChangeFacts
} from '@orthacms/schema-builder-domain';
import { ApplyInProgressError } from '../lib/domain/errors';
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

/** A lock that counts its holders and refuses a second one. */
export class CountingLock {
    held = 0;
    releases = 0;

    async acquire() {
        if (this.held > 0) throw new ApplyInProgressError();
        this.held += 1;
        return async () => {
            this.held -= 1;
            this.releases += 1;
        };
    }
}

/** An operation log in memory, keeping every saved version. */
export class MemoryOperationLog {
    readonly history: ApplyOperation[] = [];

    async save(operation: ApplyOperation) {
        this.history.push(operation);
    }

    async get(id: string) {
        return (
            [...this.history]
                .reverse()
                .find((operation) => operation.id === id) ?? null
        );
    }
}
