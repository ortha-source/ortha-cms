import { describe, expect, it } from 'vitest';
import {
    parsePublishSet,
    PUBLISH_SET_MAX_IDS,
    publishSetSearch
} from './index';

describe('publishSet', () => {
    it('round-trips through the URL', () => {
        const set = { type: 'article', ids: ['a', 'b'] };
        expect(
            parsePublishSet(new URLSearchParams(publishSetSearch(set)))
        ).toEqual(set);
    });

    it('is absent without a type or without ids', () => {
        expect(parsePublishSet(new URLSearchParams('ids=a'))).toBeNull();
        expect(parsePublishSet(new URLSearchParams('type=article'))).toBeNull();
        expect(
            parsePublishSet(new URLSearchParams('type=article&ids=,,'))
        ).toBeNull();
    });

    it('drops blanks and duplicates, and cuts at the cap', () => {
        const many = Array.from({ length: 120 }, (_, i) => `id-${i}`);
        const set = parsePublishSet(
            new URLSearchParams(`type=t&ids=a,,a,b,${many.join(',')}`)
        );
        expect(set?.ids.slice(0, 3)).toEqual(['a', 'b', 'id-0']);
        expect(set?.ids).toHaveLength(PUBLISH_SET_MAX_IDS);
    });
});
