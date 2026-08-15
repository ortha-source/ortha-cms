import { describe, expect, it } from 'vitest';
import { membersKeys } from './index';

/**
 * TanStack Query matches by key **prefix**, which is what makes
 * `invalidateQueries({ queryKey: membersKeys.all })` reach every cached list
 * page — and what would silently drag the session lists along with them if they
 * were nested under a member's detail key. These assert the scoping directly,
 * because the consequence (a refetch storm) only shows up at runtime.
 */
function isPrefixOf(prefix: readonly unknown[], key: readonly unknown[]) {
    return prefix.every((part, index) => part === key[index]);
}

describe('membersKeys', () => {
    const id = 'u_grace';

    it('covers the list pages with the root key', () => {
        expect(isPrefixOf(membersKeys.all, membersKeys.list({ page: 1 }))).toBe(
            true
        );
    });

    it('covers a member detail with the root key', () => {
        expect(isPrefixOf(membersKeys.all, membersKeys.detail(id))).toBe(true);
    });

    it('does NOT cover a member’s sessions with the root key', () => {
        // Renaming a member cannot change anyone's session list, and the
        // sessions query runs at `staleTime: 0` — so a prefix hit would refetch
        // it on every unrelated member mutation.
        expect(isPrefixOf(membersKeys.all, membersKeys.sessions(id))).toBe(
            false
        );
    });

    it('does NOT cover sessions with a member’s detail key either', () => {
        expect(
            isPrefixOf(membersKeys.detail(id), membersKeys.sessions(id))
        ).toBe(false);
    });

    it('keeps one member’s sessions distinct from another’s', () => {
        expect(membersKeys.sessions('a')).not.toEqual(
            membersKeys.sessions('b')
        );
    });
});
