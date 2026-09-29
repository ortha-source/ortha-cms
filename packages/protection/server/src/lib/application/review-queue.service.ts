import { Injectable } from '@nestjs/common';
import {
    EntryWriterService,
    InjectContentRegistry,
    entryTitle,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { HeadRevisionQuery } from '../infrastructure/head-revision.query';
import { OVERDUE_AFTER_DAYS } from './overdue';
import { ProtectionRuleRepository } from '../infrastructure/protection-rule.repository';
import { ReviewApprovalRepository } from '../infrastructure/review-approval.repository';
import { ReviewRequestRepository } from '../infrastructure/review-request.repository';
import type {
    ReviewQueueItemView,
    ReviewQueueView
} from '../types/protection-views';

/** The queue page when the caller states none. */
const DEFAULT_PAGE_SIZE = 50;

/**
 * The reviewer's queue: every open request in the workspace, across every
 * content type.
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
 */
@Injectable()
export class ReviewQueueService {
    constructor(
        private readonly requests: ReviewRequestRepository,
        private readonly approvals: ReviewApprovalRepository,
        private readonly rules: ProtectionRuleRepository,
        private readonly heads: HeadRevisionQuery,
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

        // The rule set is small (one row per protected type per workspace) and
        // read once for the whole page rather than once per line.
        const rules = await this.rules.list(workspaceId);
        // Keyed by slug alone: a content type's name is unique across both
        // kinds in the registry, so the queue does not need to resolve a row's
        // kind to find its rule.
        const requiredBy = new Map(
            rules
                .filter((rule) => rule.enabled)
                .map((rule) => [rule.slug, rule.requiredApprovals])
        );

        // The head of each entry, one indexed single-row read apiece. Bounded
        // by the page size, and it has to be per row: the request stores the
        // head *at the moment of asking*, and the whole point of the feature is
        // that the head has probably moved since.
        const heads = await Promise.all(
            page.items.map((item) =>
                this.heads.find(item.contentType, item.entryId, workspaceId)
            )
        );
        const headIds = heads
            .filter((head): head is NonNullable<typeof head> => head !== null)
            .map((head) => head.id);
        const given = await this.approvals.approvedCountsOnRevisions(
            workspaceId,
            headIds
        );
        // Each entry's title, for the same reason and at the same cost as its
        // head: one read per line of a bounded page. Without it the page could
        // only name a record by a fragment of its id.
        const titles = await Promise.all(
            page.items.map((item) =>
                this.titleOf(item.contentType, item.entryId, workspaceId)
            )
        );

        const items: ReviewQueueItemView[] = page.items.map((item, index) => {
            const head = heads[index];
            return {
                id: item.id,
                contentType: item.contentType,
                contentTypeLabel:
                    this.registry.get(item.contentType)?.label ??
                    item.contentType,
                entryId: item.entryId,
                entryTitle: titles[index],
                requestedBy: item.requestedBy,
                reviewerIds: item.reviewerIds,
                required: requiredBy.get(item.contentType) ?? 0,
                // An entry whose revisions have gone reports zero rather than
                // dropping the line: the request is still open and still the
                // reviewer's to clear.
                given: head ? (given.get(head.id) ?? 0) : 0,
                createdAt: item.createdAt.toISOString()
            };
        });

        return {
            items,
            total: page.total,
            overdueAfterDays: OVERDUE_AFTER_DAYS
        };
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
