import { PgDialect, pgTable, uuid } from 'drizzle-orm/pg-core';
import type { AnyColumn, SQL } from 'drizzle-orm';
import { buildAccessPredicate } from './access-predicate';
import type { AccessPlan } from './access-plan';

const entries = pgTable('content_article', {
    id: uuid('id').primaryKey()
});

const table = entries as unknown as Record<string, AnyColumn>;
const dialect = new PgDialect();

/** Render a fragment the way the driver would, parameters and all. */
function render(fragment: SQL | undefined) {
    if (!fragment) return undefined;
    const query = dialect.sqlToQuery(fragment);
    return { sql: query.sql, params: query.params };
}

const WORKSPACE = '11111111-1111-1111-1111-111111111111';

describe('buildAccessPredicate', () => {
    it('emits nothing for a null plan', () => {
        expect(
            buildAccessPredicate({ plan: null, table, workspaceId: WORKSPACE })
        ).toBeUndefined();
    });

    it('defaults an entry with no projected rows to visible', () => {
        const plan: AccessPlan = {
            slots: [{ slot: 1, typeKey: 'org', callerSegmentIds: [] }]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        // COALESCE(…, true) is the whole "no rule means open" rule; without it
        // enabling the plugin would black out every existing entry.
        expect(rendered?.sql).toContain('COALESCE(');
        expect(rendered?.sql).toContain('), true)');
    });

    it('ORs an entry rows together with bool_or', () => {
        const plan: AccessPlan = {
            slots: [{ slot: 1, typeKey: 'org', callerSegmentIds: [] }]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('bool_or(');
        expect(rendered?.sql).toContain('FROM entry_access ea');
    });

    it('scopes the projection lookup to the entry and the workspace', () => {
        const plan: AccessPlan = { slots: [] };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('ea.entry_id = "content_article"."id"');
        expect(rendered?.sql).toContain('ea.workspace_id =');
        expect(rendered?.params).toContain(WORKSPACE);
    });

    it('reads an empty allow array as unconstrained for that slot', () => {
        const plan: AccessPlan = {
            slots: [{ slot: 3, typeKey: 'org', callerSegmentIds: [] }]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('cardinality(ea.allow_d3) = 0');
        expect(rendered?.sql).toContain("ea.allow_d3 && '{}'::uuid[]");
    });

    it('binds the caller ids as parameters, never as literals', () => {
        const acme = '22222222-2222-2222-2222-222222222222';
        const plan: AccessPlan = {
            slots: [{ slot: 1, typeKey: 'org', callerSegmentIds: [acme] }]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.params).toContain(acme);
        expect(rendered?.sql).not.toContain(acme);
        expect(rendered?.sql).toContain('::uuid[]');
    });

    it('always negates the deny array', () => {
        const plan: AccessPlan = {
            slots: [{ slot: 2, typeKey: 'plan', callerSegmentIds: [] }]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('NOT (ea.deny_d2 &&');
    });

    it('applies the window on every slot combination', () => {
        const plan: AccessPlan = { slots: [] };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('ea.access_from IS NULL');
        expect(rendered?.sql).toContain('ea.access_to > now()');
    });

    it('ANDs every slot together', () => {
        const plan: AccessPlan = {
            slots: [
                { slot: 1, typeKey: 'org', callerSegmentIds: [] },
                { slot: 2, typeKey: 'plan', callerSegmentIds: [] }
            ]
        };
        const rendered = render(
            buildAccessPredicate({ plan, table, workspaceId: WORKSPACE })
        );
        expect(rendered?.sql).toContain('allow_d1');
        expect(rendered?.sql).toContain('allow_d2');
        expect(rendered?.sql.match(/ AND /g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('refuses a content table with no id rather than matching everything', () => {
        const idless = pgTable('weird', {
            other: uuid('other')
        }) as unknown as Record<string, AnyColumn>;
        expect(() =>
            buildAccessPredicate({
                plan: { slots: [] },
                table: idless,
                workspaceId: WORKSPACE
            })
        ).toThrow(/no `id` column/);
    });
});
