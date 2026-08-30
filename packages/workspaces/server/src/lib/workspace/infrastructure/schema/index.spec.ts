import { getTableName, isTable, type Table } from 'drizzle-orm';
import * as barrel from './index';
import { users } from './external-refs';
import { workspaces } from './workspaces';
import { memberships } from './memberships';
import { workspaceContent } from './workspace-content';

/**
 * The schema barrel is drizzle-kit's whole view of this plugin: `db:generate`
 * reads it and emits a migration for every table it finds.
 *
 * `external-refs.ts` holds a **reference-only** stub of identity's `users`,
 * carrying just the `id` column so the generated migration can emit the
 * cross-context FK `memberships.user_id → users(id)`. Identity owns and
 * migrates the physical table. Re-exporting the stub here would make
 * drizzle-kit emit a second `CREATE TABLE users` — a one-column table
 * clobbering (or colliding with) the real one, from a package that has no
 * business owning it. The safeguard is a single absent export line, which is
 * exactly the kind of thing a well-meaning "the barrel should export
 * everything" edit removes.
 */
describe('workspaces schema barrel', () => {
    /** Every drizzle table the barrel exposes to `db:generate`. */
    const EXPORTED: unknown[] = Object.values(barrel);
    const TABLES: Table[] = EXPORTED.filter((exported): exported is Table =>
        isTable(exported)
    );

    it('exposes exactly the three tables this plugin owns', () => {
        expect(TABLES.map((table) => getTableName(table)).sort()).toEqual([
            'memberships',
            'workspace_content',
            'workspaces'
        ]);
    });

    it('exports each owned table by name, so nothing is reached by path', () => {
        expect(barrel.workspaces).toBe(workspaces);
        expect(barrel.memberships).toBe(memberships);
        expect(barrel.workspaceContent).toBe(workspaceContent);
    });

    it('does not re-export the users stub under any name', () => {
        // Identity-by-value, not by key: renaming the export on the way out
        // would still hand drizzle-kit the stub.
        expect(EXPORTED).not.toContain(users);
        expect(TABLES.map((table) => getTableName(table))).not.toContain(
            'users'
        );
    });

    it('keeps the stub a real table the FK can target', () => {
        // The point of the stub is that it *is* a drizzle table — the barrel
        // simply must not be the thing that hands it to the generator.
        expect(isTable(users)).toBe(true);
        expect(getTableName(users)).toBe('users');
    });
});
