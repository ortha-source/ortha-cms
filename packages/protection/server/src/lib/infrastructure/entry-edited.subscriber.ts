import {
    Injectable,
    Logger,
    type OnApplicationBootstrap
} from '@nestjs/common';
import {
    OutboxDispatcher,
    type DomainEvent,
    type DomainEventSubscriber
} from '@orthacms/database';
import { HeadRevisionQuery } from './head-revision.query';
import { ProtectionRuleRepository } from './protection-rule.repository';
import { ReviewRequestRepository } from './review-request.repository';
import { ReviewerCandidatesQuery } from './reviewer-candidates.query';

/** A save of an existing entry — what can start the next review cycle. */
const UPDATED = 'entry.updated';

/**
 * Reopens an entry's review request when it is edited **after a publish**.
 *
 * Publishing closes the open request ({@link EntryPublishedSubscriber}): the
 * ask was satisfied. But the people asked are still this entry's reviewers, and
 * the next edit on top of the live version needs their approval again — the
 * rule gates every `draft → published`, not just the first. Without this the
 * request stayed closed, so the entry dropped out of the reviewers' queue at
 * exactly the moment it needed them, while its Review panel still listed them
 * beside their now-stale approvals.
 *
 * So a save reopens the last request — same requester, same reviewers, bound
 * to the new head — when all of these hold:
 *
 * - nothing is open already (an ask made since wins);
 * - the last request closed **because the entry published**, never because
 *   somebody withdrew it — a withdrawn ask stays withdrawn;
 * - the type has an enabled rule — on an unprotected type nothing waits on a
 *   review, and reopening would only fill a queue;
 * - the head is not live. Outbox delivery is **unordered**, so a save-and-
 *   publish in one press can hand this subscriber its `entry.updated` after
 *   the publish landed; the head it reads then is the published one, and there
 *   is nothing to review (`protection:I-23`);
 * - at least one of those reviewers can still approve here. Somebody who left
 *   the workspace or lost `content:approve` is dropped rather than left as a
 *   pending reviewer with no way to approve (`protection:I-22`).
 *
 * Idempotent under at-least-once delivery: a second delivery finds the request
 * it reopened and stops at the first check. A failure is logged, not thrown —
 * the save already committed, and a retry loop over it is worse than a missing
 * queue row.
 */
@Injectable()
export class EntryEditedSubscriber
    implements DomainEventSubscriber, OnApplicationBootstrap
{
    private readonly logger = new Logger(EntryEditedSubscriber.name);

    readonly kinds = [UPDATED] as const;

    constructor(
        private readonly requests: ReviewRequestRepository,
        private readonly rules: ProtectionRuleRepository,
        private readonly heads: HeadRevisionQuery,
        private readonly candidates: ReviewerCandidatesQuery,
        private readonly dispatcher: OutboxDispatcher
    ) {}

    onApplicationBootstrap(): void {
        this.dispatcher.register(this);
    }

    async handle(event: DomainEvent): Promise<void> {
        if (event.kind !== UPDATED) return;
        const entryId = event.aggregateId;
        const payload = event.payload as {
            contentType?: unknown;
            workspaceId?: unknown;
        };
        const contentType = payload.contentType;
        const workspaceId = payload.workspaceId;
        if (
            !entryId ||
            typeof contentType !== 'string' ||
            typeof workspaceId !== 'string'
        ) {
            return;
        }

        try {
            if (await this.requests.findOpenByEntry(entryId)) return;
            const last = await this.requests.lastResolvedByEntry(entryId);
            if (!last || last.resolution !== 'published') return;

            const protectedType = (await this.rules.list(workspaceId)).some(
                (rule) => rule.enabled && rule.slug === contentType
            );
            if (!protectedType) return;

            const head = await this.heads.find(
                contentType,
                entryId,
                workspaceId
            );
            if (!head || head.isPublished) return;

            const eligible = new Set(
                (await this.candidates.list(workspaceId, last.requestedBy)).map(
                    (candidate) => candidate.userId
                )
            );
            const reviewerIds = last.reviewerIds.filter((id) =>
                eligible.has(id)
            );
            if (!reviewerIds.length) return;

            await this.requests.open({
                workspaceId,
                contentType,
                entryId,
                revisionId: head.id,
                requestedBy: last.requestedBy,
                reviewerIds
            });
        } catch (error) {
            this.logger.warn(
                `Could not reopen the review request for entry ${entryId}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
