import { AlarmRuleRepository } from './alarm-rule.repository';

/**
 * The two things this repository decides in TypeScript rather than in SQL.
 *
 * `byTraversedType` is the first half of the reverse pass's bound: publishing
 * one author must not re-evaluate every rule in the workspace, and the filter
 * that prevents it is a walk over each stored tree — deliberately not a jsonb
 * query, because "any leaf whose `field` starts with this segment" needs an
 * index this table does not want. A walk is exactly the kind of thing that
 * quietly degrades into "return everything and let the evaluator sort it out",
 * which costs nothing visible and turns a bounded pass into a full scan.
 *
 * `update` is the other: PATCH semantics are assembled key by key, and the
 * content type's immutability is the *absence* of one of those keys.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/** A row shaped like `alarmRules.$inferSelect`, as far as the mapper reads it. */
function row(overrides: Record<string, unknown> = {}) {
    return {
        id: 'rule-1',
        workspaceId: WORKSPACE,
        contentType: 'article',
        name: 'a rule',
        findingTitle: 'a finding',
        description: null,
        severity: 'warn',
        filter: {},
        enabled: true,
        brokenReason: null,
        lastScanAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdBy: null,
        ...overrides
    };
}

/**
 * A Drizzle-shaped recorder for the chains this repository uses:
 * `select().from().where()` (awaited directly) and
 * `update().set().where().returning()`.
 */
function executor(rows: ReturnType<typeof row>[]) {
    const selects: number[] = [];
    const patches: Record<string, unknown>[] = [];

    const db = {
        select: () => {
            selects.push(selects.length);
            return { from: () => ({ where: () => Promise.resolve(rows) }) };
        },
        update: () => ({
            set: (patch: Record<string, unknown>) => {
                patches.push(patch);
                return {
                    where: () => ({ returning: async () => [rows[0] ?? row()] })
                };
            }
        })
    };

    return {
        repository: new AlarmRuleRepository({ current: () => db } as never),
        selects,
        patches
    };
}

/** Relation fields of the two types in play: articles have an author, pages none. */
const relationsOf = (contentType: string) =>
    contentType === 'article'
        ? new Map([
              ['author', 'author'],
              ['editor', 'user']
          ])
        : new Map<string, string>();

describe('AlarmRuleRepository.byTraversedType', () => {
    const TRAVERSES = row({
        id: 'traverses',
        filter: {
            and: [
                { field: 'status', op: 'eq', value: 'published' },
                { field: 'author.status', op: 'ne', value: 'published' }
            ]
        }
    });
    const SCALAR_ONLY = row({
        id: 'scalar-only',
        filter: { and: [{ field: 'status', op: 'eq', value: 'published' }] }
    });
    const OTHER_RELATION = row({
        id: 'other-relation',
        // `editor` is a relation, but it points at a user rather than an
        // author — publishing an author says nothing about this rule.
        filter: { and: [{ field: 'editor.status', op: 'eq', value: 'x' }] }
    });
    const NO_RELATIONS_AT_ALL = row({
        id: 'page-rule',
        contentType: 'page',
        filter: { and: [{ field: 'author.status', op: 'eq', value: 'x' }] }
    });

    it('returns only the rules whose tree traverses into the changed type [alarms:I-22]', async () => {
        const { repository } = executor([
            TRAVERSES,
            SCALAR_ONLY,
            OTHER_RELATION,
            NO_RELATIONS_AT_ALL
        ]);

        const found = await repository.byTraversedType(
            WORKSPACE,
            new Set(['author']),
            relationsOf
        );

        // Three of the four rows are enabled, unbroken and in the workspace, so
        // the SQL cannot be what excludes them: only the tree walk can. A
        // candidate list that returned all four would put every rule in the
        // workspace through a composed match on every publish.
        expect(found.map((candidate) => candidate.rule.id)).toEqual([
            'traverses'
        ]);
        expect(found[0].relationField).toBe('author');
    });

    it('reports the relation field the composed filter has to use [alarms:I-22]', async () => {
        const { repository } = executor([
            row({
                id: 'named-differently',
                filter: {
                    or: [{ field: 'editor.status', op: 'eq', value: 'draft' }]
                }
            })
        ]);

        const found = await repository.byTraversedType(
            WORKSPACE,
            new Set(['user']),
            relationsOf
        );

        // The evaluator composes `<relationField>.id = <changed entry>`, so the
        // field name has to come back rather than be guessed from the type.
        expect(found[0].relationField).toBe('editor');
    });

    it('asks the database nothing when there is no target type [alarms:I-22]', async () => {
        const { repository, selects } = executor([TRAVERSES]);

        expect(
            await repository.byTraversedType(
                WORKSPACE,
                new Set<string>(),
                relationsOf
            )
        ).toEqual([]);
        expect(selects).toEqual([]);
    });
});

describe('AlarmRuleRepository.update', () => {
    it('has no way to move a rule to another content type [alarms:I-15]', async () => {
        const { repository, patches } = executor([row()]);

        // The DTO refuses the key at the edge; this is the layer behind it. A
        // caller that reached the repository directly — a copilot tool, a
        // future import — still cannot rewrite the type, because the patch
        // builder has no branch that would carry it.
        await repository.update(WORKSPACE, 'rule-1', {
            name: 'renamed',
            contentType: 'product'
        } as never);

        expect(Object.keys(patches[0]).sort()).toEqual(['name', 'updatedAt']);
    });

    it('clears the broken flag when, and only when, the filter is rewritten', async () => {
        const rewritten = executor([row()]);
        await rewritten.repository.update(WORKSPACE, 'rule-1', {
            filter: { and: [{ field: 'status', op: 'eq', value: 'draft' }] }
        });
        expect(rewritten.patches[0]['brokenReason']).toBeNull();

        const renamed = executor([row()]);
        await renamed.repository.update(WORKSPACE, 'rule-1', {
            name: 'renamed'
        });
        // A rename must not un-break a rule whose filter still does not parse:
        // it would be skipped-then-thrown on the very next event.
        expect(renamed.patches[0]).not.toHaveProperty('brokenReason');
    });
});
