import {
    ACCESS_FALLBACK,
    CONDITION_MODE,
    SEGMENT_CARDINALITY,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE,
    type ResolvedAccessRule,
    type SegmentType
} from '@orthacms/segments-domain';
import { ProjectionService } from './projection.service';

/**
 * The mapping from a resolved rule to `entry_access` rows.
 *
 * `rowsFor` is where the model's asymmetries become storage, and every one of
 * them is a way to open content by accident: an exclusion that reaches only the
 * group it was written in, an `all` that writes the type's mask instead of an
 * empty array, a rule with no groups that writes no row and therefore drops its
 * own exclusions. All three are pinned here.
 */

function type(key: string, slot: number): SegmentType {
    return {
        id: `type-${key}`,
        key,
        label: key,
        cardinality: SEGMENT_CARDINALITY.Low,
        slot,
        state: SEGMENT_TYPE_STATE.Active,
        managedBy: SEGMENT_TYPE_MANAGED_BY.Ui
    };
}

/** A catalogue stub — `rowsFor` only ever asks it for a type's slot. */
const catalog = {
    typeForKey: (key: string) =>
        ({ org: type('org', 1), plan: type('plan', 2) })[key]
} as never;

const service = new ProjectionService(null as never, catalog);

const TARGET = {
    workspaceId: 'ws-1',
    typeSlug: 'article',
    entryId: 'entry-1'
};

function rule(partial: Partial<ResolvedAccessRule> = {}): ResolvedAccessRule {
    return {
        exclusions: {},
        groups: [],
        startsAt: null,
        endsAt: null,
        fallback: ACCESS_FALLBACK.Teaser,
        ...partial
    };
}

function only(...segmentIds: string[]) {
    return { mode: CONDITION_MODE.Only, segmentIds };
}

function allExcept(...segmentIds: string[]) {
    return { mode: CONDITION_MODE.AllExcept, segmentIds };
}

describe('ProjectionService.rowsFor', () => {
    it('writes one row per condition group', () => {
        const rows = service.rowsFor(
            TARGET,
            rule({
                groups: [
                    { conditions: { org: only('seg-acme') } },
                    { conditions: { plan: only('seg-pro') } }
                ]
            })
        );
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => row.groupNo)).toEqual([0, 1]);
    });

    it('puts each segment type in its own slot columns', () => {
        const [row] = service.rowsFor(
            TARGET,
            rule({
                groups: [
                    {
                        conditions: {
                            org: only('seg-acme'),
                            plan: only('seg-pro')
                        }
                    }
                ]
            })
        );
        expect(row.allowD1).toEqual(['seg-acme']);
        expect(row.allowD2).toEqual(['seg-pro']);
    });

    it('writes an empty allow array for a type set to all', () => {
        // Not the type's mask: "any reader" and "any reader carrying a tag of
        // this type" are different statements, and only the second is a segment.
        const [row] = service.rowsFor(
            TARGET,
            rule({
                groups: [
                    {
                        conditions: {
                            org: { mode: CONDITION_MODE.All, segmentIds: [] }
                        }
                    }
                ]
            })
        );
        expect(row.allowD1).toEqual([]);
        expect(row.denyD1).toEqual([]);
    });

    it('puts an all-except list in the deny column', () => {
        const [row] = service.rowsFor(
            TARGET,
            rule({ groups: [{ conditions: { org: allExcept('seg-globex') } }] })
        );
        expect(row.allowD1).toEqual([]);
        expect(row.denyD1).toEqual(['seg-globex']);
    });

    it('copies rule-level exclusions onto every group row', () => {
        // A row is considered on its own, so an exclusion recorded on only one
        // of them would be undone by any other group admitting the reader.
        const rows = service.rowsFor(
            TARGET,
            rule({
                exclusions: { org: ['seg-globex'] },
                groups: [
                    { conditions: { org: only('seg-acme') } },
                    { conditions: { plan: only('seg-pro') } }
                ]
            })
        );
        expect(rows[0].denyD1).toEqual(['seg-globex']);
        expect(rows[1].denyD1).toEqual(['seg-globex']);
    });

    it('does not duplicate an exclusion the group already denied', () => {
        const [row] = service.rowsFor(
            TARGET,
            rule({
                exclusions: { org: ['seg-globex'] },
                groups: [{ conditions: { org: allExcept('seg-globex') } }]
            })
        );
        expect(row.denyD1).toEqual(['seg-globex']);
    });

    it('writes one row for a rule that only excludes', () => {
        // With no rows at all the predicate reads the entry as unrestricted,
        // so the exclusion would be silently dropped.
        const rows = service.rowsFor(
            TARGET,
            rule({ exclusions: { org: ['seg-globex'] } })
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].denyD1).toEqual(['seg-globex']);
        expect(rows[0].allowD1).toEqual([]);
    });

    it('leaves every untouched slot empty rather than absent', () => {
        const [row] = service.rowsFor(
            TARGET,
            rule({ groups: [{ conditions: { org: only('seg-acme') } }] })
        );
        expect(row.allowD8).toEqual([]);
        expect(row.denyD8).toEqual([]);
    });

    it('carries the window and the fallback onto every row', () => {
        const from = new Date('2026-01-01T00:00:00.000Z');
        const rows = service.rowsFor(
            TARGET,
            rule({
                startsAt: from,
                fallback: ACCESS_FALLBACK.Hidden,
                groups: [
                    { conditions: { org: only('seg-acme') } },
                    { conditions: { plan: only('seg-pro') } }
                ]
            }),
            'rule-1'
        );
        for (const row of rows) {
            expect(row.accessFrom).toBe(from);
            expect(row.fallback).toBe(ACCESS_FALLBACK.Hidden);
            expect(row.ruleId).toBe('rule-1');
        }
    });

    it('drops a condition naming a segment type that no longer exists', () => {
        // Dropping it narrows nothing and widens nothing for that type — the
        // alternative is writing into whichever slot happens to be there now.
        const [row] = service.rowsFor(
            TARGET,
            rule({
                groups: [{ conditions: { gone: only('seg-x') } }]
            })
        );
        expect(row.allowD1).toEqual([]);
        expect(row.allowD2).toEqual([]);
    });

    it('refuses more groups than the model allows', () => {
        const groups = Array.from({ length: 9 }, () => ({
            conditions: { org: only('seg-acme') }
        }));
        expect(() => service.rowsFor(TARGET, rule({ groups }))).toThrow(
            /at most 8 condition groups/
        );
    });
});
