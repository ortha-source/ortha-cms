import {
    ACCESS_FALLBACK,
    ACCESS_LEVEL,
    CONDITION_MODE,
    INHERIT
} from './access-rule';
import { evaluate } from './evaluate';
import { resolveAccess, type AccessLevel } from './inheritance';

const NOW = new Date('2026-06-01T12:00:00.000Z');

function only(...segmentIds: string[]) {
    return { mode: CONDITION_MODE.Only, segmentIds };
}

/** The chain a typical entry sits under, with the two levels that speak. */
function chain(
    type: AccessLevel['rule'],
    entry: AccessLevel['rule']
): AccessLevel[] {
    return [
        { name: ACCESS_LEVEL.Installation, rule: null },
        { name: ACCESS_LEVEL.Workspace, rule: null },
        { name: ACCESS_LEVEL.Type, rule: type },
        { name: ACCESS_LEVEL.Entry, rule: entry }
    ];
}

describe('resolveAccess', () => {
    it('leaves a silent chain unrestricted', () => {
        const { rule, contributors } = resolveAccess(chain(null, null));
        expect(rule.groups).toEqual([]);
        expect(rule.exclusions).toEqual({});
        expect(contributors).toEqual([]);
    });

    it('merges a lower level onto what it inherits', () => {
        const { rule } = resolveAccess(
            chain(
                { groups: [{ plan: only('seg-pro') }] },
                { groups: [{ org: only('seg-acme') }] }
            )
        );
        expect(rule.groups).toHaveLength(2);
        expect(rule.groups[0].source).toBe(ACCESS_LEVEL.Type);
        expect(rule.groups[1].source).toBe(ACCESS_LEVEL.Entry);
    });

    it('keeps the merged groups OR-ed, not AND-ed', () => {
        const { rule } = resolveAccess(
            chain(
                { groups: [{ plan: only('seg-pro') }] },
                { groups: [{ org: only('seg-acme') }] }
            )
        );
        // Acme on a trial plan matches only the entry's own group — which is
        // exactly what merging must preserve.
        expect(
            evaluate({
                rule,
                callerSegmentIds: new Set(['seg-acme']),
                now: NOW
            })
        ).toMatchObject({ visible: true, matchedGroup: 1 });
    });

    it('drops inherited groups when a level detaches', () => {
        const { rule, detachedAt } = resolveAccess(
            chain(
                { groups: [{ plan: only('seg-pro') }] },
                { detachInherited: true }
            )
        );
        expect(rule.groups).toEqual([]);
        expect(detachedAt).toBe(ACCESS_LEVEL.Entry);
    });

    it('keeps exclusions across a detach', () => {
        const { rule } = resolveAccess(
            chain(
                { exclusions: { org: ['seg-globex'] } },
                { detachInherited: true }
            )
        );
        expect(rule.exclusions).toEqual({ org: ['seg-globex'] });
    });

    it('unions exclusions from every level without duplicating', () => {
        const { rule } = resolveAccess(
            chain(
                { exclusions: { org: ['seg-globex'] } },
                { exclusions: { org: ['seg-globex', 'seg-initech'] } }
            )
        );
        expect(rule.exclusions['org']).toEqual(['seg-globex', 'seg-initech']);
    });

    it('resolves an inherit condition from the group above it', () => {
        const { rule } = resolveAccess(
            chain(
                { groups: [{ plan: only('seg-pro') }] },
                {
                    groups: [
                        {
                            plan: { mode: INHERIT, segmentIds: [] },
                            org: only('seg-acme')
                        }
                    ]
                }
            )
        );
        expect(rule.groups[1].conditions['plan']).toEqual(only('seg-pro'));
    });

    it('drops an inherit condition with nothing to inherit', () => {
        const { rule } = resolveAccess(
            chain(null, {
                groups: [{ plan: { mode: INHERIT, segmentIds: [] } }]
            })
        );
        expect(rule.groups[0].conditions).toEqual({});
    });

    it('lets the nearest level win the window', () => {
        const early = new Date('2026-01-01T00:00:00.000Z');
        const late = new Date('2026-09-01T00:00:00.000Z');
        const { rule } = resolveAccess(
            chain({ startsAt: early }, { startsAt: late })
        );
        expect(rule.startsAt).toBe(late);
    });

    it('lets the nearest level win the fallback', () => {
        const { rule } = resolveAccess(
            chain(
                { fallback: ACCESS_FALLBACK.Teaser },
                { fallback: ACCESS_FALLBACK.Hidden }
            )
        );
        expect(rule.fallback).toBe(ACCESS_FALLBACK.Hidden);
    });

    it('records only the levels that said something', () => {
        const { contributors } = resolveAccess(
            chain(null, { groups: [{ org: only('seg-acme') }] })
        );
        expect(contributors).toEqual([ACCESS_LEVEL.Entry]);
    });

    it('lets an explicit null window clear an inherited one', () => {
        const { rule } = resolveAccess(
            chain(
                { endsAt: new Date('2026-07-01T00:00:00.000Z') },
                { endsAt: null }
            )
        );
        expect(rule.endsAt).toBeNull();
    });
});
