import type { MemberCounts } from '../../domain/types/member';
import type { MembersListParams } from '../../infrastructure/membersKeys';

/**
 * The roster's one-click views: everyone, the admins, the invites still
 * waiting, the suspended. Each is an ordinary list parameter, so they compose
 * with search and the advanced filter rather than replacing them.
 */
export const MEMBERS_QUICK_FILTERS = [
    'everyone',
    'admins',
    'invited',
    'disabled'
] as const;

/** One quick filter. */
export type MembersQuickFilter = (typeof MEMBERS_QUICK_FILTERS)[number];

/** The URL parameter that carries the quick filter (`?show=invited`). */
export const QUICK_FILTER_PARAM = 'show';

/** Reads the quick filter from its URL value; anything unknown is "everyone". */
export function quickFilterFrom(value: string | null): MembersQuickFilter {
    return (MEMBERS_QUICK_FILTERS as readonly string[]).includes(value ?? '')
        ? (value as MembersQuickFilter)
        : 'everyone';
}

/** The list parameters a quick filter stands for. */
export function quickFilterParams(
    filter: MembersQuickFilter
): Pick<MembersListParams, 'status' | 'role'> {
    switch (filter) {
        case 'admins':
            return { role: 'admin' };
        case 'invited':
            return { status: 'pending' };
        case 'disabled':
            return { status: 'disabled' };
        default:
            return {};
    }
}

/** The count a quick filter's chip shows. */
export function quickFilterCount(
    filter: MembersQuickFilter,
    counts: MemberCounts
): number {
    return filter === 'everyone' ? counts.everyone : counts[filter];
}
