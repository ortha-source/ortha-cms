import type { InboxCategory, InboxKind } from '@orthacms/inbox-domain';

/** One item, as `GET /api/inbox` lists it. */
export interface InboxItemView {
    id: string;
    kind: InboxKind;
    category: InboxCategory;
    /** The workspace it concerns, or `null`. The admin names it from its own list. */
    workspaceId: string | null;
    /** What the sentence is rendered from — shaped by `kind`. */
    payload: Record<string, unknown>;
    /** App-relative path the item opens. */
    link: string;
    /** ISO-8601. */
    createdAt: string;
    /** ISO-8601, or `null` while unread. */
    readAt: string | null;
}

/** `GET /api/inbox` — one page, newest first. */
export interface InboxPageView {
    items: InboxItemView[];
    /** Pass as `before` for the next page; `null` on the last. */
    nextCursor: string | null;
}

/** `GET /api/inbox/summary` — the unread counts. */
export interface InboxSummaryView {
    unread: number;
    byCategory: Record<InboxCategory, number>;
}
