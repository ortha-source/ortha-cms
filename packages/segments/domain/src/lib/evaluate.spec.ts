import {
    ACCESS_FALLBACK,
    CONDITION_MODE,
    type ResolvedAccessRule,
    type ResolvedConditionGroup
} from './access-rule';
import { DENIAL_REASON, evaluate } from './evaluate';

const NOW = new Date('2026-06-01T12:00:00.000Z');

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

function group(
    conditions: ResolvedConditionGroup['conditions']
): ResolvedConditionGroup {
    return { conditions };
}

function only(...segmentIds: string[]) {
    return { mode: CONDITION_MODE.Only, segmentIds };
}

function allExcept(...segmentIds: string[]) {
    return { mode: CONDITION_MODE.AllExcept, segmentIds };
}

const all = { mode: CONDITION_MODE.All, segmentIds: [] };

function decide(r: ResolvedAccessRule, ...caller: string[]) {
    return evaluate({
        rule: r,
        callerSegmentIds: new Set(caller),
        now: NOW
    });
}

describe('evaluate', () => {
    describe('a rule that restricts nothing', () => {
        it('admits a reader carrying no segments at all', () => {
            expect(decide(rule())).toEqual({ visible: true, matchedGroup: -1 });
        });

        it('reports -1 rather than a group index', () => {
            const decision = decide(rule(), 'seg-pro');
            expect(decision).toMatchObject({ visible: true, matchedGroup: -1 });
        });
    });

    describe('exclusions', () => {
        it('refuse a reader even when a group would admit them', () => {
            const r = rule({
                exclusions: { org: ['seg-globex'] },
                groups: [group({ org: allExcept('seg-nobody') })]
            });
            expect(decide(r, 'seg-globex')).toMatchObject({
                visible: false,
                reason: DENIAL_REASON.Excluded
            });
        });

        it('are absolute across segment types', () => {
            const r = rule({
                exclusions: { org: ['seg-globex'] },
                groups: [group({ plan: only('seg-enterprise') })]
            });
            expect(decide(r, 'seg-globex', 'seg-enterprise')).toMatchObject({
                visible: false,
                reason: DENIAL_REASON.Excluded
            });
        });

        it('leave an unmatched reader to the groups', () => {
            const r = rule({
                exclusions: { org: ['seg-globex'] },
                groups: [group({ org: only('seg-acme') })]
            });
            expect(decide(r, 'seg-acme')).toEqual({
                visible: true,
                matchedGroup: 0
            });
        });

        it('close an entry on their own, with no groups declared', () => {
            const r = rule({ exclusions: { org: ['seg-globex'] } });
            expect(decide(r, 'seg-globex')).toMatchObject({ visible: false });
            expect(decide(r, 'seg-acme')).toMatchObject({ visible: true });
        });

        it('carry no closest group — nothing would have helped', () => {
            const r = rule({
                exclusions: { org: ['seg-globex'] },
                groups: [group({ plan: only('seg-pro') })]
            });
            const decision = decide(r, 'seg-globex');
            expect(decision).not.toHaveProperty('closest');
        });
    });

    describe('the window', () => {
        it('hides an entry before it opens', () => {
            const r = rule({ startsAt: new Date('2026-07-01T00:00:00.000Z') });
            expect(decide(r)).toMatchObject({
                visible: false,
                reason: DENIAL_REASON.Window
            });
        });

        it('hides an entry after it closes', () => {
            const r = rule({ endsAt: new Date('2026-05-01T00:00:00.000Z') });
            expect(decide(r)).toMatchObject({
                visible: false,
                reason: DENIAL_REASON.Window
            });
        });

        it('treats the end instant as already closed', () => {
            const r = rule({ endsAt: NOW });
            expect(decide(r)).toMatchObject({ visible: false });
        });

        it('treats the start instant as already open', () => {
            const r = rule({ startsAt: NOW });
            expect(decide(r)).toMatchObject({ visible: true });
        });

        it('is checked before any group matches', () => {
            const r = rule({
                startsAt: new Date('2026-07-01T00:00:00.000Z'),
                groups: [group({ org: only('seg-acme') })]
            });
            expect(decide(r, 'seg-acme')).toMatchObject({
                reason: DENIAL_REASON.Window
            });
        });
    });

    describe('one group', () => {
        it('AND-s the segment types inside it', () => {
            const r = rule({
                groups: [group({ geo: only('seg-eu'), plan: only('seg-pro') })]
            });
            expect(decide(r, 'seg-eu', 'seg-pro')).toMatchObject({
                visible: true
            });
            expect(decide(r, 'seg-eu')).toMatchObject({ visible: false });
            expect(decide(r, 'seg-pro')).toMatchObject({ visible: false });
        });

        it('OR-s the segments inside one type', () => {
            const r = rule({
                groups: [group({ plan: only('seg-pro', 'seg-enterprise') })]
            });
            expect(decide(r, 'seg-enterprise')).toMatchObject({
                visible: true
            });
        });

        it('does not constrain on a type set to all', () => {
            const r = rule({ groups: [group({ org: all })] });
            expect(decide(r)).toMatchObject({ visible: true });
        });

        it('admits everyone outside an all-except list', () => {
            const r = rule({
                groups: [group({ org: allExcept('seg-globex') })]
            });
            expect(decide(r, 'seg-acme')).toMatchObject({ visible: true });
            expect(decide(r, 'seg-globex')).toMatchObject({ visible: false });
        });

        it('admits nobody when only names no segments', () => {
            const r = rule({ groups: [group({ plan: only() })] });
            expect(decide(r, 'seg-pro')).toMatchObject({ visible: false });
        });

        it('admits everyone when the group names no types', () => {
            const r = rule({ groups: [group({})] });
            expect(decide(r)).toEqual({ visible: true, matchedGroup: 0 });
        });
    });

    describe('several groups', () => {
        const partnerAccess = rule({
            exclusions: { org: ['seg-globex'] },
            groups: [
                group({ org: only('seg-acme') }),
                group({
                    geo: only('seg-eu'),
                    plan: only('seg-pro', 'seg-enterprise')
                })
            ]
        });

        it('admit a reader matching the first group alone', () => {
            expect(decide(partnerAccess, 'seg-acme', 'seg-trial')).toEqual({
                visible: true,
                matchedGroup: 0
            });
        });

        it('admit a reader matching only the second group', () => {
            expect(
                decide(partnerAccess, 'seg-initech', 'seg-eu', 'seg-pro')
            ).toEqual({ visible: true, matchedGroup: 1 });
        });

        it('refuse a reader matching neither', () => {
            expect(
                decide(partnerAccess, 'seg-initech', 'seg-us', 'seg-pro')
            ).toMatchObject({
                visible: false,
                reason: DENIAL_REASON.NoGroup
            });
        });

        it('let an exclusion outrank a matching group', () => {
            expect(
                decide(partnerAccess, 'seg-globex', 'seg-eu', 'seg-pro')
            ).toMatchObject({ reason: DENIAL_REASON.Excluded });
        });

        it('stop at the first match rather than reporting later failures', () => {
            expect(decide(partnerAccess, 'seg-acme')).toEqual({
                visible: true,
                matchedGroup: 0
            });
        });
    });

    describe('the closest group', () => {
        it('is the one with the fewest failing conditions', () => {
            const r = rule({
                groups: [
                    group({ geo: only('seg-eu'), plan: only('seg-pro') }),
                    group({ org: only('seg-acme') })
                ]
            });
            // Group 0 fails on both of its types, group 1 on one — so the
            // second is the one worth reporting even though it is declared
            // later.
            const decision = decide(r, 'seg-initech');
            expect(decision).toMatchObject({
                visible: false,
                closest: { index: 1, failed: ['org'] }
            });
        });

        it('names the segments that would have satisfied an only', () => {
            const r = rule({
                groups: [group({ plan: only('seg-pro', 'seg-enterprise') })]
            });
            const decision = decide(r, 'seg-trial');
            expect(decision).toMatchObject({
                closest: {
                    requires: { plan: ['seg-pro', 'seg-enterprise'] }
                }
            });
        });

        it('names nothing for a failing all-except', () => {
            const r = rule({
                groups: [group({ org: allExcept('seg-globex') })]
            });
            const decision = decide(r, 'seg-globex');
            expect(decision).toMatchObject({
                closest: { failed: ['org'], requires: {} }
            });
        });

        it('breaks a tie by declaration order', () => {
            const r = rule({
                groups: [
                    group({ org: only('seg-acme') }),
                    group({ plan: only('seg-pro') })
                ]
            });
            const decision = decide(r, 'seg-nobody');
            expect(decision).toMatchObject({ closest: { index: 0 } });
        });
    });

    describe('the fallback', () => {
        it('travels with every refusal', () => {
            const r = rule({
                fallback: ACCESS_FALLBACK.Hidden,
                groups: [group({ plan: only('seg-pro') })]
            });
            expect(decide(r)).toMatchObject({
                fallback: ACCESS_FALLBACK.Hidden
            });
        });
    });
});
