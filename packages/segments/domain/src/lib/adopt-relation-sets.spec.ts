import { CONDITION_MODE } from './access-rule';
import { isUnrestricted } from './access-rule';
import { evaluate } from './evaluate';
import { resolveAccess } from './inheritance';
import {
    groupByRelationSets,
    relationSetsFit,
    ruleFromRelationSets
} from './adopt-relation-sets';

describe('ruleFromRelationSets', () => {
    it('turns an include list into an `only` on the axis', () => {
        const rule = ruleFromRelationSets('plan', {
            included: ['pro', 'team'],
            excluded: []
        });
        expect(rule.groups?.[0]['plan']).toEqual({
            mode: CONDITION_MODE.Only,
            segmentIds: ['pro', 'team']
        });
        expect(rule.exclusions).toEqual({});
    });

    /**
     * The trap the whole function exists for: an empty include list means
     * *everyone* in the relation scheme and *nobody* as an `only`. Translating
     * it literally would black out every unrestricted entry in the library on
     * migration day.
     */
    it('translates an empty include list to `all`, not to an empty `only`', () => {
        const rule = ruleFromRelationSets('plan', {
            included: [],
            excluded: []
        });
        // No group at all, not a group whose only condition is `all` — the two
        // admit the same readers, but only the first is `isUnrestricted`, and
        // that is what keeps the entry out of the projection entirely.
        expect(rule.groups).toEqual([]);

        // And the end-to-end consequence: an anonymous reader still gets in.
        const { rule: resolved } = resolveAccess([{ name: 'entry', rule }]);
        expect(isUnrestricted(resolved)).toBe(true);
        expect(
            evaluate({
                rule: resolved,
                callerSegmentIds: new Set(),
                now: new Date()
            }).visible
        ).toBe(true);
    });

    it('stores the exclusion, never the complement', () => {
        const rule = ruleFromRelationSets('org', {
            included: [],
            excluded: ['globex']
        });
        expect(rule.exclusions).toEqual({ org: ['globex'] });
        // The include side stays open — "everyone except Globex" is one
        // exclusion, not 399 admissions — and open means no group.
        expect(rule.groups).toEqual([]);
    });

    it('excludes even a reader the include list admits', () => {
        const rule = ruleFromRelationSets('org', {
            included: ['acme', 'globex'],
            excluded: ['globex']
        });
        const { rule: resolved } = resolveAccess([{ name: 'entry', rule }]);
        expect(
            evaluate({
                rule: resolved,
                callerSegmentIds: new Set(['acme']),
                now: new Date()
            }).visible
        ).toBe(true);
        expect(
            evaluate({
                rule: resolved,
                callerSegmentIds: new Set(['globex']),
                now: new Date()
            }).visible
        ).toBe(false);
    });

    it('produces at most one group — the source carries no disjunction', () => {
        const rule = ruleFromRelationSets('plan', {
            included: ['pro'],
            excluded: ['trial']
        });
        expect(rule.groups).toHaveLength(1);
    });

    it('normalises duplicates and order, so two spellings are one rule', () => {
        const a = ruleFromRelationSets('plan', {
            included: ['team', 'pro', 'pro'],
            excluded: []
        });
        const b = ruleFromRelationSets('plan', {
            included: ['pro', 'team'],
            excluded: []
        });
        expect(a).toEqual(b);
    });
});

describe('groupByRelationSets', () => {
    it('collapses entries sharing a combination onto one rule', () => {
        const grouped = groupByRelationSets([
            { entry: 'a', sets: { included: ['pro'], excluded: [] } },
            { entry: 'b', sets: { included: ['pro'], excluded: [] } },
            { entry: 'c', sets: { included: ['team'], excluded: [] } }
        ]);
        expect(grouped.groups).toHaveLength(2);
        expect(
            grouped.groups.find((group) => group.sets.included.includes('pro'))
                ?.entries
        ).toEqual(['a', 'b']);
    });

    it('treats a differently ordered list as the same combination', () => {
        const grouped = groupByRelationSets([
            { entry: 'a', sets: { included: ['pro', 'team'], excluded: [] } },
            { entry: 'b', sets: { included: ['team', 'pro'], excluded: [] } }
        ]);
        expect(grouped.groups).toHaveLength(1);
        expect(grouped.groups[0].entries).toEqual(['a', 'b']);
    });

    /**
     * These need no rule and no assignment, and their count is the first number
     * an adopter checks against their own — "we had 38,000 open articles" is
     * the migration's own sanity check.
     */
    it('sets aside entries that restrict nobody', () => {
        const grouped = groupByRelationSets([
            { entry: 'open', sets: { included: [], excluded: [] } },
            { entry: 'closed', sets: { included: ['pro'], excluded: [] } }
        ]);
        expect(grouped.unrestricted).toEqual(['open']);
        expect(grouped.groups).toHaveLength(1);
    });

    it('distinguishes an exclusion from an admission of the same segment', () => {
        const grouped = groupByRelationSets([
            { entry: 'a', sets: { included: ['pro'], excluded: [] } },
            { entry: 'b', sets: { included: [], excluded: ['pro'] } }
        ]);
        expect(grouped.groups).toHaveLength(2);
    });
});

describe('relationSetsFit', () => {
    it('accepts what the model can express and refuses what it cannot', () => {
        expect(relationSetsFit(1)).toBe(true);
        expect(relationSetsFit(8)).toBe(true);
        expect(relationSetsFit(9)).toBe(false);
    });
});
