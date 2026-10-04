import { join } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from '@orthacms/database';
import type { MigrationRunner } from '../../domain/ports/migration-runner.port';

/**
 * {@link MigrationRunner} over drizzle's migrator — the same function
 * `db:migrate` runs, against the same folder and tracking table the host's
 * `ContentPlugin` descriptor names. drizzle applies every pending migration
 * inside one transaction, so a failure leaves the database as it was.
 */
export class DrizzleMigrationRunner implements MigrationRunner {
    constructor(
        private readonly db: Database,
        private readonly folder: string,
        private readonly table: string
    ) {}

    static at(
        db: Database,
        root: string,
        migrationsDir: string,
        table: string
    ): DrizzleMigrationRunner {
        return new DrizzleMigrationRunner(db, join(root, migrationsDir), table);
    }

    run(): Promise<void> {
        return migrate(this.db, {
            migrationsFolder: this.folder,
            migrationsTable: this.table
        });
    }
}
