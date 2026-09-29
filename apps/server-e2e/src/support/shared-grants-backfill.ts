import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool } from '@orthacms/database';
import { WorkspacesPlugin } from '@orthacms/workspaces-server';

/** The migration that introduced explicit per-source content grants. */
const MIGRATION = '0002_shared_content_grants.sql';

/**
 * The **data** half of the explicit-grants migration (ADR-0019, "Explicit
 * per-source grants"): the hand-appended `INSERT … SELECT` that turned the
 * old implicit rule into explicit shared grants.
 *
 * Read from the committed migration file rather than restated, so the spec
 * pins the SQL that actually ships. The harness has already applied the
 * migration to an empty schema — where the backfill inserted nothing — so a
 * spec seeds the pre-migration shape and re-runs just this statement.
 * Idempotent (`ON CONFLICT DO NOTHING`), like the migration itself.
 */
export async function runSharedGrantsBackfill(): Promise<void> {
    // The plugin's own migrations descriptor — the folder the host applies.
    const dir = WorkspacesPlugin().migrations?.dir();
    if (!dir) {
        throw new Error('The workspaces plugin ships no migrations.');
    }
    const sql = readFileSync(join(dir, MIGRATION), 'utf8');
    const statements = sql.split('--> statement-breakpoint');
    const backfill = statements.find((statement) =>
        /INSERT INTO "workspace_content"/.test(statement)
    );
    if (!backfill) {
        throw new Error(`${MIGRATION} carries no backfill statement.`);
    }
    await getPool().query(backfill);
}
