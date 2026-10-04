/** One drizzle-kit run. Paths are relative to the project root. */
export interface GenerateMigrationInput {
    /** The manifest whose exported tables are the schema to diff (`…/index.ts`). */
    readonly schema: string;
    /** The migrations folder: its snapshots are the baseline, the new SQL lands here. */
    readonly out: string;
    /** The migration's name suffix. */
    readonly name: string;
}

/** What one run produced. Empty when the schema matched the snapshot. */
export interface GeneratedMigration {
    /** New files under `out`, relative to it. */
    readonly files: readonly string[];
    /** The new migration's SQL; `''` when nothing changed. */
    readonly sql: string;
}

/** Generates a migration by diffing a schema against a migrations folder's snapshot. */
export interface MigrationGenerator {
    generate(input: GenerateMigrationInput): Promise<GeneratedMigration>;
}
