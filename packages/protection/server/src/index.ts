/**
 * Public API of `@orthacms/protection-server` — the publication-protection
 * plugin.
 *
 * A per-content-type rule requiring N approvals before an entry may be
 * published. This package owns the three tables and the rule surface; the
 * **decision** those rules feed is `evaluateProtection` in
 * `@orthacms/protection-domain`, and it is re-exported nowhere here — a
 * consumer that needs it depends on the kernel, which needs no framework.
 *
 * Registering the plugin changes nothing on its own: with no rule written,
 * publication behaves byte for byte as it does with the plugin uninstalled.
 */

export { ProtectionPlugin } from './lib/utils/protection-plugin';
export { ProtectionModule } from './lib/protection.module';

// The rule surface, for the guard provider a later PR adds and for any host
// that wants to read a rule without going through HTTP.
export { ProtectionRulesService } from './lib/application/protection-rules.service';
export { ProtectionRuleRepository } from './lib/infrastructure/protection-rule.repository';
export type { SaveProtectionRuleInput } from './lib/infrastructure/protection-rule.repository';
export { SaveProtectionRuleDto } from './lib/application/dto/save-protection-rule.dto';
export { REQUIRED_APPROVALS_MAX } from './lib/application/dto/save-protection-rule.dto';
export type { ProtectionRuleView } from './lib/types/protection-views';

// The review surface, for the publish guard a later PR adds: it has to read the
// same votes against the same head, through the same service, or the button and
// the refusal will disagree.
export { EntryReviewService } from './lib/application/entry-review.service';
export type { ReviewActor } from './lib/application/entry-review.service';
export { ReviewQueueService } from './lib/application/review-queue.service';
export { HeadRevisionQuery } from './lib/infrastructure/head-revision.query';
export type { HeadRevision } from './lib/infrastructure/head-revision.query';
export { ReviewApprovalRepository } from './lib/infrastructure/review-approval.repository';
export { ReviewRequestRepository } from './lib/infrastructure/review-request.repository';
export type {
    EntryReviewView,
    ReviewApprovalView,
    ReviewQueueItemView,
    ReviewQueueView,
    ReviewRequestView
} from './lib/types/protection-views';
export {
    ReviewNoteDto,
    REVIEW_NOTE_MAX
} from './lib/application/dto/review-note.dto';
export {
    ReviewQueueQueryDto,
    REVIEW_QUEUE_PAGE_MAX
} from './lib/application/dto/review-queue-query.dto';

// The event catalogue, so `activity-server`'s mapper and any future subscriber
// can name a kind rather than repeat a string literal.
export {
    PROTECTION_EVENT_KINDS,
    protectionRuleEvent,
    reviewEvent
} from './lib/protection.events';

export {
    UnknownProtectedContentTypeError,
    ReviewableEntryNotFoundError,
    ReviewRequestNotFoundError,
    ReviewRequestNotYoursError,
    SelfApprovalRefusedError
} from './lib/domain/errors';

// The tables, so the host's tooling and other plugins' queries can name them
// rather than re-declaring a `pgTable` that would drift.
export {
    protectionRules,
    reviewApprovals,
    reviewRequests
} from './lib/infrastructure/schema';
