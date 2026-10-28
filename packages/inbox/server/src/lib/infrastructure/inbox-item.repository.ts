import { Injectable } from '@nestjs/common';
import {
    and,
    count,
    desc,
    eq,
    exists,
    isNull,
    lt,
    or,
    sql,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, UnitOfWork, type Database } from '@orthacms/database';
import {
    categoryOf,
    type InboxCategory,
    type InboxDelivery,
    type InboxKind
} from '@orthacms/inbox-domain';
import { memberships } from '@orthacms/workspaces-server';
import { inboxItems } from './schema/inbox-items';

/** A stored item, as the service passes it around. */
export interface StoredInboxItem {
    id: string;
    kind: InboxKind;
    category: InboxCategory;
    workspaceId: string | null;
    payload: Record<string, unknown>;
    link: string;
    createdAt: Date;
    readAt: Date | null;
}

/** Where a page starts: strictly older than this item. */
export interface InboxCursor {
    createdAt: Date;
    id: string;
}

/**
 * The inbox table: delivery, one person's pages and counts, the read state.
 *
 * Two executors, like mail's queue, for the opposite reason. A delivery made
 * by a use case joins that use case's transaction (`UnitOfWork.current()`), so
 * an item about a write that rolled back is never stored. A delivery made from
 * an outbox subscriber has no unit of work around it, and `current()` is then
 * the base pool — which is fine, because `(user_id, dedupe_key)` is unique and
 * a retried delivery is a no-op.
 */
@Injectable()
export class InboxItemRepository {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly uow: UnitOfWork
    ) {}

    async deliver(items: readonly InboxDelivery[]): Promise<void> {
        if (!items.length) return;
        await this.uow
            .current()
            .insert(inboxItems)
            .values(
                items.map((item) => ({
                    userId: item.userId,
                    workspaceId: item.workspaceId,
                    kind: item.kind,
                    category: categoryOf(item.kind),
                    payload: item.payload as unknown as Record<string, unknown>,
                    link: item.link,
                    dedupeKey: item.dedupeKey
                }))
            )
            .onConflictDoNothing({
                target: [inboxItems.userId, inboxItems.dedupeKey]
            });
    }

    /**
     * What a person may see: their own items, about no workspace or about one
     * they still belong to. Leaving a workspace hides its items rather than
     * deleting them, so rejoining brings them back.
     */
    private visibleTo(userId: string): SQL {
        return and(
            eq(inboxItems.userId, userId),
            or(
                isNull(inboxItems.workspaceId),
                exists(
                    this.db
                        .select({ one: sql`1` })
                        .from(memberships)
                        .where(
                            and(
                                eq(memberships.userId, userId),
                                eq(
                                    memberships.workspaceId,
                                    inboxItems.workspaceId
                                )
                            )
                        )
                )
            )
        ) as SQL;
    }

    /** One page of a person's items, newest first. */
    async page(
        userId: string,
        options: {
            category?: InboxCategory;
            unreadOnly?: boolean;
            before?: InboxCursor;
            limit: number;
        }
    ): Promise<StoredInboxItem[]> {
        const conditions: SQL[] = [this.visibleTo(userId)];
        if (options.category) {
            conditions.push(eq(inboxItems.category, options.category));
        }
        if (options.unreadOnly) {
            conditions.push(isNull(inboxItems.readAt));
        }
        if (options.before) {
            conditions.push(
                or(
                    lt(inboxItems.createdAt, options.before.createdAt),
                    and(
                        eq(inboxItems.createdAt, options.before.createdAt),
                        lt(inboxItems.id, options.before.id)
                    )
                ) as SQL
            );
        }
        const rows = await this.db
            .select()
            .from(inboxItems)
            .where(and(...conditions))
            .orderBy(desc(inboxItems.createdAt), desc(inboxItems.id))
            .limit(options.limit);
        return rows.map((row) => ({
            id: row.id,
            kind: row.kind as InboxKind,
            category: row.category as InboxCategory,
            workspaceId: row.workspaceId,
            payload: row.payload,
            link: row.link,
            createdAt: row.createdAt,
            readAt: row.readAt
        }));
    }

    /** Unread counts per tab, in one grouped read. */
    async unreadByCategory(
        userId: string
    ): Promise<Partial<Record<InboxCategory, number>>> {
        const rows = await this.db
            .select({ category: inboxItems.category, total: count() })
            .from(inboxItems)
            .where(and(this.visibleTo(userId), isNull(inboxItems.readAt)))
            .groupBy(inboxItems.category);
        return Object.fromEntries(
            rows.map((row) => [row.category, Number(row.total)])
        );
    }

    /**
     * Marks one of the person's own items read. Someone else's id matches no
     * row, which reads exactly like an id that does not exist.
     */
    async markRead(userId: string, id: string): Promise<boolean> {
        const updated = await this.db
            .update(inboxItems)
            .set({ readAt: new Date() })
            .where(
                and(
                    eq(inboxItems.id, id),
                    eq(inboxItems.userId, userId),
                    isNull(inboxItems.readAt)
                )
            )
            .returning({ id: inboxItems.id });
        if (updated.length) return true;
        // Already read is still a success; only a foreign or unknown id is not.
        const [own] = await this.db
            .select({ id: inboxItems.id })
            .from(inboxItems)
            .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
            .limit(1);
        return Boolean(own);
    }

    /** Marks every unread item of the person read, optionally one tab's. */
    async markAllRead(
        userId: string,
        category?: InboxCategory
    ): Promise<number> {
        const updated = await this.db
            .update(inboxItems)
            .set({ readAt: new Date() })
            .where(
                and(
                    eq(inboxItems.userId, userId),
                    isNull(inboxItems.readAt),
                    ...(category ? [eq(inboxItems.category, category)] : [])
                )
            )
            .returning({ id: inboxItems.id });
        return updated.length;
    }

    /** A deleted workspace's items, for the purge registry. */
    async purgeWorkspace(workspaceId: string): Promise<number> {
        const removed = await this.uow
            .current()
            .delete(inboxItems)
            .where(eq(inboxItems.workspaceId, workspaceId))
            .returning({ id: inboxItems.id });
        return removed.length;
    }
}
