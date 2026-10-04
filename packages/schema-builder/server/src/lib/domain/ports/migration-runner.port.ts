/** Applies the content migrations still pending, all in one transaction. */
export interface MigrationRunner {
    run(): Promise<void>;
}
