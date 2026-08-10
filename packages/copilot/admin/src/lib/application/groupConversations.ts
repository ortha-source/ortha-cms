import type { CopilotConversation } from './useConversations';

/**
 * Which recency bucket a thread falls in. Ids rather than labels, so the rail
 * owns the wording (and its translation) and this file owns only the
 * arithmetic.
 */
export type ConversationGroupId =
    | 'today'
    | 'yesterday'
    | 'week'
    | 'month'
    | 'older';

/** One labelled run of threads in the rail. */
export interface ConversationGroup {
    id: ConversationGroupId;
    conversations: CopilotConversation[];
}

/** The order the rail renders the buckets in — newest first. */
const GROUP_ORDER: ConversationGroupId[] = [
    'today',
    'yesterday',
    'week',
    'month',
    'older'
];

/**
 * Whole days between two instants, counted by **calendar day** rather than by
 * elapsed milliseconds.
 *
 * That distinction is the whole reason this is a function: "yesterday" means
 * yesterday, not 24-to-48 hours ago. A thread from 11pm last night must not sit
 * under "Today" at 1am because only two hours have passed. Normalising each date
 * to a UTC midnight of its *local* Y/M/D also makes the subtraction immune to
 * the DST transition that would otherwise land an hour either side of a
 * boundary.
 */
function calendarDaysBetween(later: Date, earlier: Date): number {
    const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
    const b = Date.UTC(
        earlier.getFullYear(),
        earlier.getMonth(),
        earlier.getDate()
    );
    return Math.round((a - b) / 86_400_000);
}

/** Which bucket an instant belongs to, relative to `now`. */
function bucketOf(updatedAt: string, now: Date): ConversationGroupId {
    const when = new Date(updatedAt);
    // An unparseable timestamp is data we cannot place. "Older" is the honest
    // bucket for it — better than `NaN` days silently landing it under Today.
    if (Number.isNaN(when.getTime())) {
        return 'older';
    }
    const days = calendarDaysBetween(now, when);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days <= 7) return 'week';
    if (days <= 30) return 'month';
    return 'older';
}

/**
 * Groups threads into the rail's date sections, preserving the server's order
 * (most recently used first) inside each one.
 *
 * Empty buckets are dropped rather than rendered as a heading over nothing —
 * a "Yesterday" label with no rows under it reads as a loading failure.
 */
export function groupConversations(
    conversations: CopilotConversation[],
    now: Date
): ConversationGroup[] {
    const buckets = new Map<ConversationGroupId, CopilotConversation[]>();
    for (const conversation of conversations) {
        const id = bucketOf(conversation.updatedAt, now);
        const list = buckets.get(id) ?? [];
        list.push(conversation);
        buckets.set(id, list);
    }

    return GROUP_ORDER.flatMap((id) => {
        const list = buckets.get(id);
        return list && list.length > 0 ? [{ id, conversations: list }] : [];
    });
}

/**
 * Filters threads by a typed query, matched against the title.
 *
 * An **untitled** thread matches nothing but the empty query. The alternative —
 * keeping every untitled thread in every result set — would fill a search for
 * "invoice" with rows the user cannot tell apart, and the title is the only text
 * the list route carries; searching message bodies would need a server that can
 * do it.
 */
export function filterConversations(
    conversations: CopilotConversation[],
    query: string
): CopilotConversation[] {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) {
        return conversations;
    }
    return conversations.filter((conversation) =>
        (conversation.title ?? '').toLocaleLowerCase().includes(needle)
    );
}
