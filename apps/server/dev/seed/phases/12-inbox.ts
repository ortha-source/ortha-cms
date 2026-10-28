/**
 * The inbox's read state.
 *
 * The items themselves are not seeded here: the protection and alarms phases
 * wrote them, through the producers, exactly as a request, an approval, a
 * stale vote or a new finding does at run time. What no producer decides is
 * what each person has already *seen* — so this marks as read, through
 * `InboxService`, what its reader would plausibly have dealt with: requests
 * that have since been resolved or withdrawn, and "ready to publish" items for
 * entries that went live. Everything else stays unread. The backdate phase
 * then moves the read items into the past, so Today and Earlier both show.
 */
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { InboxService, inboxItems } from '@orthacms/inbox-server';
import { reviewRequests } from '../../../../../packages/protection/server/src/lib/infrastructure/schema/review-requests';
import type { SeedContext } from '../context';

export async function seedInbox(ctx: SeedContext): Promise<void> {
    const inbox = ctx.get(InboxService);

    // `review.requested:<requestId>:<revisionId>` — the request is the key's
    // second segment.
    const handled = await ctx.db
        .select({ id: inboxItems.id, userId: inboxItems.userId })
        .from(inboxItems)
        .innerJoin(
            reviewRequests,
            sql`${reviewRequests.id}::text = split_part(${inboxItems.dedupeKey}, ':', 2)`
        )
        .where(
            and(
                eq(inboxItems.kind, 'review.requested'),
                isNotNull(reviewRequests.resolvedAt)
            )
        );

    const live = ['review_published', 'review_reopened'].map(
        (key) => ctx.entry(key).id
    );
    const published = await ctx.db
        .select({ id: inboxItems.id, userId: inboxItems.userId })
        .from(inboxItems)
        .where(
            and(
                eq(inboxItems.kind, 'review.ready'),
                inArray(sql<string>`${inboxItems.payload}->>'entryId'`, live)
            )
        );

    for (const item of [...handled, ...published]) {
        await inbox.markRead(item.userId, item.id);
    }

    ctx.section('Inbox', [
        '- `reviewer@dev.local` — review requests (one overdue, from five days ago), the resolved ones read; stale-approval notices',
        '- `editor@dev.local` — "ready to publish", the ones that went live read',
        '- `editor2@dev.local`, `admin2@dev.local` — review requests',
        '- `admin@dev.local` — alarm findings in **two** workspaces, Main and Library',
        '- `/inbox/settings` — the alarm digest frequency (mail goes to the console provider)'
    ]);
}
