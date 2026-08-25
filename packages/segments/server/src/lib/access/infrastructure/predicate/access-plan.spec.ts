import {
    SEGMENT_CARDINALITY,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE,
    type SegmentType
} from '@orthacms/segments-domain';
import { planAccessPredicate } from './access-plan';

function type(
    key: string,
    slot: number,
    state: SegmentType['state'] = SEGMENT_TYPE_STATE.Active
): SegmentType {
    return {
        id: `type-${key}`,
        key,
        label: key,
        cardinality: SEGMENT_CARDINALITY.Low,
        slot,
        state,
        managedBy: SEGMENT_TYPE_MANAGED_BY.Ui
    };
}

describe('planAccessPredicate', () => {
    it('emits nothing when no segment type exists', () => {
        expect(planAccessPredicate([], new Map())).toBeNull();
    });

    it('emits nothing when every type is draining', () => {
        const types = [type('org', 1, SEGMENT_TYPE_STATE.Draining)];
        expect(planAccessPredicate(types, new Map())).toBeNull();
    });

    it('still plans for a reader carrying nothing', () => {
        // An anonymous reader is not an unconfigured installation: the
        // predicate must be emitted so restricted entries stay hidden.
        const plan = planAccessPredicate([type('org', 1)], new Map());
        expect(plan).not.toBeNull();
        expect(plan?.slots).toEqual([
            { slot: 1, typeKey: 'org', callerSegmentIds: [] }
        ]);
    });

    it('excludes a draining type from the decision', () => {
        const types = [
            type('org', 1),
            type('role', 2, SEGMENT_TYPE_STATE.Draining)
        ];
        const caller = new Map([
            ['org', ['seg-acme']],
            ['role', ['seg-admin']]
        ]);
        const plan = planAccessPredicate(types, caller);
        expect(plan?.slots.map((slot) => slot.typeKey)).toEqual(['org']);
    });

    it('excludes a free slot', () => {
        const types = [
            type('org', 1),
            type('gone', 2, SEGMENT_TYPE_STATE.Free)
        ];
        const plan = planAccessPredicate(types, new Map());
        expect(plan?.slots).toHaveLength(1);
    });

    it('carries the caller ids of each type onto its slot', () => {
        const types = [type('plan', 2), type('org', 1)];
        const caller = new Map([
            ['org', ['seg-acme', 'seg-any-org']],
            ['plan', ['seg-pro']]
        ]);
        const plan = planAccessPredicate(types, caller);
        expect(plan?.slots).toEqual([
            {
                slot: 1,
                typeKey: 'org',
                callerSegmentIds: ['seg-acme', 'seg-any-org']
            },
            { slot: 2, typeKey: 'plan', callerSegmentIds: ['seg-pro'] }
        ]);
    });

    it('orders slots ascending regardless of catalogue order', () => {
        const types = [type('c', 3), type('a', 1), type('b', 2)];
        const plan = planAccessPredicate(types, new Map());
        expect(plan?.slots.map((slot) => slot.slot)).toEqual([1, 2, 3]);
    });

    it('gives a type the caller has nothing in an empty id list', () => {
        const types = [type('org', 1), type('plan', 2)];
        const caller = new Map([['org', ['seg-acme']]]);
        const plan = planAccessPredicate(types, caller);
        expect(plan?.slots[1]).toEqual({
            slot: 2,
            typeKey: 'plan',
            callerSegmentIds: []
        });
    });
});
