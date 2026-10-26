import { Injectable } from '@nestjs/common';
import {
    EntryWriterService,
    InjectContentRegistry,
    entryTitle,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { EntryChangesQuery } from '../infrastructure/entry-changes.query';
import { HeadRevisionQuery } from '../infrastructure/head-revision.query';
import { OVERDUE_AFTER_DAYS } from './overdue';
import { ProtectionRuleRepository } from '../infrastructure/protection-rule.repository';
import { ReviewApprovalRepository } from '../infrastructure/review-approval.repository';
import { ReviewRequestRepository } from '../infrastructure/review-request.repository';
import type {
    RecentlyApprovedItemView,
    RecentlyApprovedView,
    ReviewQueueItemView,
    ReviewQueueView
} from '../types/protection-views';

/** The queue page when the caller states none. */
const DEFAULT_PAGE_SIZE = 50;

/** How far back "Recently approved" looks. */
export const RECENTLY_APPROVED_DAYS = 30;

/** How many entries "Recently approved" lists at most. */
export const RECENTLY_APPROVED_LIMIT = 50;

/** What every line about one entry carries, whichever tab it is on. */
interface EntryLine {
    contentTypeLabel: string;
    entryTitle: string | null;
    required: number;
    given: number;
    headRevisionId: string | null;
    headRevisionNumber: number | null;
    headPublished: boolean;
    liveRevisionNumber: number | null;
    fieldsChanged: number | null;
}

/**
 * The reviewer's queue: every open request in the workspace, across every
 * content type — and, beside it, what the caller approved lately.
 *
 * It exists because without it approvals are possible and nobody knows they are
 * wanted. Until the mail port lands (ORT-207) this page is the *only* way a
 * reviewer learns there is work, which is why it is a page of its own rather
 * than a saved view of one collection's records list — a saved view can only
 * ever ask about the collection it belongs to.
 *
 * The counts beside each line are a hint, not a verdict. The entry route runs
 * the full decision; this one shows "1 of 2" so a reviewer can tell a queue of
 * nearly-done work from a queue of untouched work, and it deliberately stops
 * short of `requireOtherPerson` — applying it here would mean a rule lookup and
 * an author comparison per line for a column nothing gates on.
 *
 * **Each line also says how much changed since the entry was live** — "3
 * fields changed" — so a reviewer can tell a typo from a rewrite before opening
 * anything. That costs one timeline read and two snapshot reads per line of a
 * bounded page, through content's `RevisionStore` and `diffSnapshots`; the
 * side panel then draws the same comparison field by field.
 */
@Injectable()
export class ReviewQueueService {
    constructor(
        private readonly requests: ReviewRequestRepository,
        private readonly approvals: ReviewApprovalRepository,
        private readonly rules: ProtectionRuleRepository,
        private readonly heads: HeadRevisionQuery,
        private readonly changes: EntryChangesQuery,
        private readonly entries: EntryWriterService,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /** One page of open requests, newest first. */
    async list(
        workspaceId: string,
        options: { mine?: boolean; limit?: number; offset?: number },
        callerId: string
    ): Promise<ReviewQueueView> {
        const page = await this.requests.queue(workspaceId, {
            requestedBy: options.mine ? callerId : undefined,
            limit: options.limit ?? DEFAULT_PAGE_SIZE,
            offset: options.offset ?? 0
        });
        if (!page.items.length) {
            return {
                items: [],
                total: page.total,
                overdueAfterDays: OVERDUE_AFTER_DAYS
            };
        }

        const lines = await this.linesFor(workspaceId, page.items);
        const items: ReviewQueueItemView[] = page.items.map((item, index) => {
            const line = lines[index];
            return {
                id: item.id,
                contentType: item.contentType,
                contentTypeLabel: line.contentTypeLabel,
                entryId: item.entryId,
                entryTitle: line.entryTitle,
                requestedBy: item.requestedBy,
                reviewerIds: item.reviewerIds,
                required: line.required,
                given: line.given,
                createdAt: item.createdAt.toISOString(),
                headRevisionNumber: line.headRevisionNumber,
                liveRevisionNumber: line.liveRevisionNumber,
                fieldsChanged: line.fieldsChanged
            };
        });

        return {
            items,
            total: page.total,
            overdueAfterDays: OVERDUE_AFTER_DAYS
        };
    }

    /**
     * The entries the caller approved in the last
     * {@link RECENTLY_APPROVED_DAYS} days, newest approval first — one line per
     * entry. It answers *did I already approve that?*, so it lists the
     * caller's own votes and nobody else's, open request or not.
     */
    async recentlyApproved(
        workspaceId: string,
        callerId: string,
        now: Date = new Date()
    ): Promise<RecentlyApprovedView> {
        const since = new Date(
            now.getTime() - RECENTLY_APPROVED_DAYS * 86_400_000
        );
        const recent = await this.approvals.recentByUser(
            workspaceId,
            callerId,
            since,
            RECENTLY_APPROVED_LIMIT
        );
        if (!recent.length) {
            return { items: [], windowDays: RECENTLY_APPROVED_DAYS };
        }

        const entryIds = recent.map((item) => item.entryId);
        const [lines, asks, votes] = await Promise.all([
            this.linesFor(workspaceId, recent),
            this.requests.latestByEntries(workspaceId, entryIds),
            this.approvals.listForEntries(workspaceId, entryIds)
        ]);

        const items: RecentlyApprovedItemView[] = recent.map((item, index) => {
            const line = lines[index];
            const ask = asks.get(item.entryId) ?? null;
            const mine = (votes.get(item.entryId) ?? []).filter(
                (vote) => vote.userId === callerId
            );
            return {
                id: item.entryId,
                contentType: item.contentType,
                contentTypeLabel: line.contentTypeLabel,
                entryId: item.entryId,
                entryTitle: line.entryTitle,
                requestedBy: ask?.requestedBy ?? null,
                reviewerIds: ask?.reviewerIds ?? [],
                required: line.required,
                given: line.given,
                approvedAt: item.approvedAt.toISOString(),
                approvalCurrent:
                    line.headRevisionId !== null &&
                    mine.some(
                        (vote) => vote.revisionId === line.headRevisionId
                    ),
                headPublished: line.headPublished,
                headRevisionNumber: line.headRevisionNumber,
                liveRevisionNumber: line.liveRevisionNumber,
                fieldsChanged: line.fieldsChanged
            };
        });

        return { items, windowDays: RECENTLY_APPROVED_DAYS };
    }

    /**
     * Everything a line says about its entry, for a bounded page of them, in
     * page order.
     *
     * The rule set is read once (one row per protected type); the head, the
     * title and the change count are per line — the head has to be, because
     * the request stores the head *at the moment of asking* and the whole point
     * of the feature is that it has probably moved since. The approval counts
     * on those heads are one query for the page.
     */
    private async linesFor(
        workspaceId: string,
        items: readonly { contentType: string; entryId: string }[]
    ): Promise<EntryLine[]> {
        const rules = await this.rules.list(workspaceId);
        // Keyed by slug alone: a content type's name is unique across both
        // kinds in the registry, so the queue does not need to resolve a row's
        // kind to find its rule.
        const requiredBy = new Map(
            rules
                .filter((rule) => rule.enabled)
                .map((rule) => [rule.slug, rule.requiredApprovals])
        );

        const timelines = await Promise.all(
            items.map((item) =>
                this.heads.headAndLive(
                    item.contentType,
                    item.entryId,
                    workspaceId
                )
            )
        );
        const headIds = timelines
            .filter((found): found is NonNullable<typeof found> => !!found)
            .map((found) => found.head.id);
        const [given, titles, changed] = await Promise.all([
            this.approvals.approvedCountsOnRevisions(workspaceId, headIds),
            // Each entry's title, for the same reason and at the same cost as
            // its head: one read per line of a bounded page. Without it the
            // page could only name a record by a fragment of its id.
            Promise.all(
                items.map((item) =>
                    this.titleOf(item.contentType, item.entryId, workspaceId)
                )
            ),
            Promise.all(
                items.map((item, index) => {
                    const found = timelines[index];
                    if (!found) return Promise.resolve(null);
                    // A count that cannot be computed is left unsaid rather
                    // than failing the whole queue over one line's hint.
                    return this.changes
                        .fieldsChanged(
                            item.contentType,
                            item.entryId,
                            workspaceId,
                            found.head.number,
                            found.live?.number ?? null
                        )
                        .catch(() => null);
                })
            )
        ]);

        return items.map((item, index) => {
            const found = timelines[index];
            return {
                contentTypeLabel:
                    this.registry.get(item.contentType)?.label ??
                    item.contentType,
                entryTitle: titles[index],
                required: requiredBy.get(item.contentType) ?? 0,
                // An entry whose revisions have gone reports zero rather than
                // dropping the line: the request is still open and still the
                // reviewer's to clear.
                given: found ? (given.get(found.head.id) ?? 0) : 0,
                headRevisionId: found?.head.id ?? null,
                headRevisionNumber: found?.head.number ?? null,
                headPublished: found?.head.isPublished ?? false,
                liveRevisionNumber: found?.live?.number ?? null,
                fieldsChanged: changed[index]
            };
        });
    }

    /**
     * The entry's display title, or `null` — for a type no longer registered,
     * an entry that has gone (its request is still open and still the
     * reviewer's to clear), or one with no title-eligible value, where the
     * content helper falls back to the id and the page does that itself.
     */
    private async titleOf(
        contentType: string,
        entryId: string,
        workspaceId: string
    ): Promise<string | null> {
        const type = this.registry.get(contentType);
        if (!type) return null;
        try {
            const record = await this.entries.getOne(
                type,
                entryId,
                workspaceId
            );
            const title = entryTitle(type, { ...record.values, id: entryId });
            return title === entryId ? null : title;
        } catch {
            return null;
        }
    }
}
