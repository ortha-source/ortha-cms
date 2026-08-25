import {
    SEGMENT_KIND,
    groupSegmentIdsByType,
    segmentIdsForTags,
    segmentMatchesTag,
    type Segment
} from './segment';
import { tagNamespace } from './segment-type';

const acme: Segment = {
    id: 'seg-acme',
    typeKey: 'org',
    key: 'acme',
    label: 'Acme Corp',
    kind: SEGMENT_KIND.Set,
    tags: ['org:acme']
};

const anyOrg: Segment = {
    id: 'seg-any-org',
    typeKey: 'org',
    key: '*',
    label: 'Any organisation',
    kind: SEGMENT_KIND.Mask,
    tags: []
};

const pro: Segment = {
    id: 'seg-pro',
    typeKey: 'plan',
    key: 'pro',
    label: 'Pro',
    kind: SEGMENT_KIND.Set,
    // Two tags, one segment: the legacy identifier keeps working after a
    // rename in the billing system without touching a single rule.
    tags: ['plan:pro', 'plan:professional']
};

const catalog = [acme, anyOrg, pro];

describe('tagNamespace', () => {
    it('reads the namespace before the first colon', () => {
        expect(tagNamespace('org:acme')).toBe('org');
    });

    it('keeps a colon inside the value', () => {
        expect(tagNamespace('org:acme:eu')).toBe('org');
    });

    it('has no namespace for a bare tag', () => {
        expect(tagNamespace('pro')).toBeUndefined();
    });

    it('has no namespace for a leading colon', () => {
        expect(tagNamespace(':acme')).toBeUndefined();
    });
});

describe('segmentMatchesTag', () => {
    it('matches a set segment on any of its tags', () => {
        expect(segmentMatchesTag(pro, 'plan:professional')).toBe(true);
    });

    it('does not match a set segment on a foreign tag', () => {
        expect(segmentMatchesTag(pro, 'plan:trial')).toBe(false);
    });

    it('matches a mask on any tag in its namespace', () => {
        expect(segmentMatchesTag(anyOrg, 'org:whoever')).toBe(true);
    });

    it('does not let a mask cross namespaces', () => {
        expect(segmentMatchesTag(anyOrg, 'plan:pro')).toBe(false);
    });

    it('does not let a mask swallow a bare tag', () => {
        expect(segmentMatchesTag(anyOrg, 'org')).toBe(false);
    });
});

describe('segmentIdsForTags', () => {
    it('resolves a reader into every segment they fall into', () => {
        expect(segmentIdsForTags(catalog, ['org:acme', 'plan:pro'])).toEqual(
            new Set(['seg-acme', 'seg-any-org', 'seg-pro'])
        );
    });

    it('includes the mask for an organisation with no segment of its own', () => {
        expect(segmentIdsForTags(catalog, ['org:initech'])).toEqual(
            new Set(['seg-any-org'])
        );
    });

    it('resolves an anonymous reader to nothing', () => {
        expect(segmentIdsForTags(catalog, [])).toEqual(new Set());
    });

    it('accepts a Set as readily as a list', () => {
        expect(segmentIdsForTags(catalog, new Set(['plan:pro']))).toEqual(
            new Set(['seg-pro'])
        );
    });
});

describe('groupSegmentIdsByType', () => {
    it('buckets resolved ids by their segment type', () => {
        const ids = segmentIdsForTags(catalog, ['org:acme', 'plan:pro']);
        const byType = groupSegmentIdsByType(catalog, ids);
        expect(byType.get('org')).toEqual(['seg-acme', 'seg-any-org']);
        expect(byType.get('plan')).toEqual(['seg-pro']);
    });

    it('omits a type the reader has nothing in', () => {
        const ids = segmentIdsForTags(catalog, ['plan:pro']);
        expect(groupSegmentIdsByType(catalog, ids).has('org')).toBe(false);
    });
});
