import { Module, type DynamicModule } from '@nestjs/common';
import { contentPublishGuardRegistrar } from '@orthacms/content-server';
import { EntryReviewService } from './application/entry-review.service';
import { ProtectionRulesService } from './application/protection-rules.service';
import { ReviewQueueService } from './application/review-queue.service';
import { HeadRevisionQuery } from './infrastructure/head-revision.query';
import { ReviewApprovalRepository } from './infrastructure/review-approval.repository';
import { ReviewRequestRepository } from './infrastructure/review-request.repository';
import { EntryReviewController } from './http/controllers/entry-review.controller';
import { ReviewQueueController } from './http/controllers/review-queue.controller';
import { ProtectionRuleRepository } from './infrastructure/protection-rule.repository';
import { ProtectionWorkspacePurger } from './infrastructure/purge/protection-workspace.purger';
import { ProtectionRulesController } from './http/controllers/protection-rules.controller';
import { PublishProtectionGuard } from './infrastructure/publish-protection.guard';
import { EntryPublishedSubscriber } from './infrastructure/entry-published.subscriber';

/**
 * The protection plugin's module — three tables, one controller.
 *
 * Global, so the rule lookup is injectable from where the publish path is
 * actually guarded: `PublishProtectionGuard` runs inside content's write
 * transaction, not from a route of this package's own.
 *
 * Registered **after** `ContentPlugin`, whose registry and grant query it reads
 * to decide which types a workspace may write a rule for.
 *
 * `forRoot()` takes nothing. The rule table is the whole configuration surface
 * and its empty state is the off state — a plugin that had to be switched on
 * twice, once by the operator and once per workspace, is the settings screen
 * ADR-0009 deleted.
 */
@Module({})
export class ProtectionModule {
    /** Creates the global dynamic module. */
    static forRoot(): DynamicModule {
        return {
            module: ProtectionModule,
            global: true,
            controllers: [
                ProtectionRulesController,
                // Order matters to Nest's router: `protection/queue` is a
                // literal path, and `protection/entries/:type/:id` cannot
                // shadow it — but registering the specific one first keeps that
                // true if either prefix is ever widened.
                ReviewQueueController,
                EntryReviewController
            ],
            providers: [
                ProtectionRulesService,
                ProtectionRuleRepository,
                EntryReviewService,
                ReviewQueueService,
                ReviewRequestRepository,
                ReviewApprovalRepository,
                // Asks content which revision is currently the head. Reading
                // `content_entry_revisions` directly would tie this package to
                // a table it does not own and cannot migrate.
                HeadRevisionQuery,
                // Clears this workspace's rules, requests and approvals on
                // delete. All three carry a plain `workspace_id` with no FK, so
                // without this they outlive the workspace — the exact residue a
                // live stand found in four other tables.
                ProtectionWorkspacePurger,
                // The third gate. Registering it is what makes every rule in
                // this package mean anything — and the registrar's optional
                // injection is why a deployment without `ContentPlugin` boots
                // instead of failing on a dependency it cannot influence.
                PublishProtectionGuard,
                contentPublishGuardRegistrar(
                    'protection',
                    PublishProtectionGuard
                ),
                // Closes an open review request when the entry it was about
                // actually goes out, however it was published.
                EntryPublishedSubscriber
            ],
            exports: [
                ProtectionRulesService,
                ProtectionRuleRepository,
                EntryReviewService,
                ReviewRequestRepository,
                ReviewApprovalRepository,
                HeadRevisionQuery,
                PublishProtectionGuard
            ]
        };
    }
}
