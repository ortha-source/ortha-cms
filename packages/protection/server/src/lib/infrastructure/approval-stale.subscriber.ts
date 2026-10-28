import {
    Injectable,
    Logger,
    Optional,
    type OnApplicationBootstrap
} from '@nestjs/common';
import {
    OutboxDispatcher,
    type DomainEvent,
    type DomainEventSubscriber
} from '@orthacms/database';
import { ReviewNotifier } from '../application/review-notifier';
import { HeadRevisionQuery } from './head-revision.query';
import { ProtectionRuleRepository } from './protection-rule.repository';
import { ReviewApprovalRepository } from './review-approval.repository';
import { ReviewRequestRepository } from './review-request.repository';

/** A save of an existing entry — what can leave approvals behind. */
const UPDATED = 'entry.updated';

/**
 * Tells the people whose approval a save just left behind that it no longer
 * counts — the inbox's "your approval on Pricing FAQ no longer counts".
 *
 * An approval belongs to a revision; a save writes a new head no vote is bound
 * to. That is the whole design (ADR-0017), and the editor shows it — but the
 * reviewer is not in the editor. So on `entry.updated`, when all of these
 * hold, the approvers of the **version the save replaced** are told:
 *
 * - the type has an enabled rule that does **not** count stale approvals — if
 *   it does, nothing stopped counting;
 * - a review is still open on the entry — a record nobody is waiting on is not
 *   news worth an item;
 * - the head is not live (outbox delivery is unordered, as
 *   `EntryEditedSubscriber` explains).
 *
 * The saver is never told about their own save. Idempotent under at-least-once
 * delivery through the inbox's `dedupeKey` (entry and new head); a failure is
 * logged, not thrown — the save already committed.
 */
@Injectable()
export class ApprovalStaleSubscriber
    implements DomainEventSubscriber, OnApplicationBootstrap
{
    private readonly logger = new Logger(ApprovalStaleSubscriber.name);

    readonly kinds = [UPDATED] as const;

    constructor(
        private readonly rules: ProtectionRuleRepository,
        private readonly requests: ReviewRequestRepository,
        private readonly approvals: ReviewApprovalRepository,
        private readonly heads: HeadRevisionQuery,
        private readonly dispatcher: OutboxDispatcher,
        @Optional() private readonly notifier?: ReviewNotifier
    ) {}

    onApplicationBootstrap(): void {
        this.dispatcher.register(this);
    }

    async handle(event: DomainEvent): Promise<void> {
        if (event.kind !== UPDATED || !this.notifier) return;
        const entryId = event.aggregateId;
        const payload = event.payload as {
            contentType?: unknown;
            workspaceId?: unknown;
            actor?: { id?: unknown };
        };
        const { contentType, workspaceId } = payload;
        if (
            !entryId ||
            typeof contentType !== 'string' ||
            typeof workspaceId !== 'string'
        ) {
            return;
        }
        const saverId =
            typeof payload.actor?.id === 'string' ? payload.actor.id : null;

        try {
            const rule = (await this.rules.list(workspaceId)).find(
                (candidate) =>
                    candidate.enabled && candidate.slug === contentType
            );
            if (!rule || rule.countStaleApprovals) return;
            if (!(await this.requests.findOpenByEntry(entryId))) return;

            const [head, previous] = await this.heads.timeline(
                contentType,
                entryId,
                workspaceId
            );
            if (!head || !previous) return;
            const current = await this.heads.find(
                contentType,
                entryId,
                workspaceId
            );
            if (!current || current.isPublished || current.id !== head.id)
                return;

            const left = (
                await this.approvals.listForEntry(workspaceId, entryId)
            )
                .filter((vote) => vote.revisionId === previous.id)
                .map((vote) => vote.userId)
                .filter((userId) => userId !== saverId);
            if (!left.length) return;

            await this.notifier.approvalsStale({
                workspaceId,
                contentType,
                entryId,
                userIds: [...new Set(left)],
                approvedRevisionNumber: previous.number,
                headRevisionId: head.id
            });
        } catch (error) {
            this.logger.warn(
                `Could not tell approvers of entry ${entryId} their approval no longer counts: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }
}
