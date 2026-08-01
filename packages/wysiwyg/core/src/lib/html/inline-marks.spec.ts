import {
    INLINE_MARK_TAG,
    isBlockMarked,
    toggleBlockMark
} from './inline-marks';
import { blockRangeBetween } from '../document/tree';

describe('toggleBlockMark', () => {
    it('wraps an unmarked block', () => {
        expect(toggleBlockMark('hello', INLINE_MARK_TAG.Bold)).toBe(
            '<strong>hello</strong>'
        );
    });

    it('unwraps a block that is wholly marked', () => {
        expect(
            toggleBlockMark('<strong>hello</strong>', INLINE_MARK_TAG.Bold)
        ).toBe('hello');
    });

    it('marks the lot when only part of the block carries it', () => {
        expect(
            toggleBlockMark('<strong>a</strong> b', INLINE_MARK_TAG.Bold)
        ).toBe('<strong><strong>a</strong> b</strong>');
    });

    it('leaves an empty block alone', () => {
        expect(toggleBlockMark('', INLINE_MARK_TAG.Bold)).toBe('');
        expect(toggleBlockMark('   ', INLINE_MARK_TAG.Italic)).toBe('   ');
    });

    it('ignores whitespace around the mark when deciding', () => {
        expect(isBlockMarked(' <em>x</em> ', INLINE_MARK_TAG.Italic)).toBe(
            true
        );
    });
});

describe('blockRangeBetween', () => {
    it('covers the run between two siblings, either way round', () => {
        expect(blockRangeBetween([1], [3])).toEqual([[1], [2], [3]]);
        expect(blockRangeBetween([3], [1])).toEqual([[1], [2], [3]]);
    });

    it('resolves two depths at their common ancestor', () => {
        expect(blockRangeBetween([0], [2, 1, 4])).toEqual([[0], [1], [2]]);
    });

    it('collapses to the ancestor when one path contains the other', () => {
        expect(blockRangeBetween([2], [2, 0, 1])).toEqual([[2]]);
    });

    it('returns the single block for a path with itself', () => {
        expect(blockRangeBetween([1, 2], [1, 2])).toEqual([[1, 2]]);
    });
});
