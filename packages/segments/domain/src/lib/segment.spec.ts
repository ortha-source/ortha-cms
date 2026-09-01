import { isOfferedIn, segmentIdsForTags } from './segment';

describe('isOfferedIn', () => {
    const anywhere = { id: 's1', key: 'acme', label: 'Acme', tags: ['acme'] };
    const scoped = { ...anywhere, workspaceIds: ['w1', 'w2'] };

    it('offers an unscoped audience everywhere', () => {
        // The state every segment starts in, and the reason emptiness reads as
        // "all" rather than "none": the opposite would make every existing
        // audience vanish from every editor the day the column shipped.
        expect(isOfferedIn(anywhere, 'w9')).toBe(true);
        expect(isOfferedIn({ ...anywhere, workspaceIds: [] }, 'w9')).toBe(true);
    });

    it('offers a scoped audience only where it is named', () => {
        expect(isOfferedIn(scoped, 'w1')).toBe(true);
        expect(isOfferedIn(scoped, 'w3')).toBe(false);
    });

    it('refuses a scoped audience when no workspace is known', () => {
        // Fail closed: a caller that cannot say where it is cannot be shown to
        // be somewhere the audience was offered.
        expect(isOfferedIn(scoped, undefined)).toBe(false);
        expect(isOfferedIn(anywhere, undefined)).toBe(true);
    });
});

/**
 * The one place a raw reader tag is compared to anything.
 *
 * Everything above this function deals in segment ids — an entry's lists, the
 * SQL predicate, the editor's controls — which is what makes an identifier
 * renamed upstream one row edited in the directory rather than a migration over
 * every entry that named it. So the matching rule here is the whole seam between
 * a deployment's own vocabulary and this model's.
 */
describe('segmentIdsForTags', () => {
    const acme = {
        id: 's-acme',
        key: 'acme',
        label: 'Acme',
        tags: ['acme', 'acme-legacy']
    };
    const globex = {
        id: 's-globex',
        key: 'globex',
        label: 'Globex',
        tags: ['globex']
    };
    const catalogue = [acme, globex];

    it('matches a segment on any one of its tags', () => {
        // The reason tags are a list: the same audience arrives under a legacy
        // plan code and a current one, and both have to land on one segment.
        expect(segmentIdsForTags(catalogue, ['acme'])).toEqual(
            new Set(['s-acme'])
        );
        expect(segmentIdsForTags(catalogue, ['acme-legacy'])).toEqual(
            new Set(['s-acme'])
        );
    });

    it('returns every segment a reader\u2019s tags reach', () => {
        expect(segmentIdsForTags(catalogue, ['acme', 'globex'])).toEqual(
            new Set(['s-acme', 's-globex'])
        );
    });

    it('names a segment once however many of its tags a reader carries', () => {
        // A Set, not a list, and this is the case that shows why: the ids go
        // into an array overlap, where a duplicate would be noise at best.
        expect(segmentIdsForTags(catalogue, ['acme', 'acme-legacy'])).toEqual(
            new Set(['s-acme'])
        );
    });

    it('matches exactly, and is case-sensitive', () => {
        // No pattern, no prefix, no namespace. Those exist to say "any of this
        // kind", which this model answers by not asking: an entry lists the
        // segments that may read it, and "any" is the empty list.
        expect(segmentIdsForTags(catalogue, ['ACME'])).toEqual(new Set());
        expect(segmentIdsForTags(catalogue, ['acme '])).toEqual(new Set());
        expect(segmentIdsForTags(catalogue, ['acm'])).toEqual(new Set());
    });

    it('resolves an unknown tag to nothing rather than to everything', () => {
        // The anonymous reader by another route. Resolving an unrecognised tag
        // to the whole catalogue would make a typo upstream an open door.
        expect(segmentIdsForTags(catalogue, ['nobody-has-this'])).toEqual(
            new Set()
        );
    });

    it('gives the anonymous reader an empty set', () => {
        // Who then sees exactly the entries with an empty allow list — there is
        // no branch for them anywhere, and this is why there needs to be none.
        expect(segmentIdsForTags(catalogue, [])).toEqual(new Set());
    });

    it('never matches a segment that answers to no tag', () => {
        // A tagless segment can only ever close content. The directory defaults
        // `tags` to the key so one is not created by accident, but a row edited
        // down to none must still match nobody rather than everybody.
        const tagless = { id: 's-none', key: 'none', label: 'None', tags: [] };
        expect(segmentIdsForTags([tagless], ['none'])).toEqual(new Set());
        expect(segmentIdsForTags([tagless], [])).toEqual(new Set());
    });

    it('answers an empty catalogue with an empty set', () => {
        // The inert installation: nothing configured, so nothing to resolve.
        expect(segmentIdsForTags([], ['acme'])).toEqual(new Set());
    });
});
