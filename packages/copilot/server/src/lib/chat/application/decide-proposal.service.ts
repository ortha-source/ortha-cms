import { Injectable, Logger } from '@nestjs/common';
import type { ProposalApplier } from '@ortha-cms/copilot-domain';
import {
    ProposalRepository,
    type ProposalView
} from '../infrastructure/persistence/proposal.repository';
import { CapabilityProfileService } from './capability-profile.service';
import { ProposalApplierRegistry } from './proposal-applier.registry';

/** Who is deciding, and where. */
export interface Decider {
    userId: string;
    /** The decider's email — frozen onto the audit event the write raises. */
    email: string;
    roleId: string;
    workspaceId: string;
}

/** Why a decision could not be made. */
export type DecisionRefusal =
    /** No such proposal in this workspace. */
    | 'not-found'
    /** Someone already accepted or rejected it. */
    | 'already-decided'
    /** The decider could not have proposed this themselves. */
    | 'not-permitted'
    /** No plugin claimed this proposal's kind — a wiring bug, not a user error. */
    | 'no-applier'
    /** The applier ran and failed; the proposal stays pending. */
    | 'apply-failed';

/** The outcome of an accept or reject. */
export type DecisionOutcome =
    | { ok: true; proposal: ProposalView }
    | { ok: false; reason: DecisionRefusal; message: string };

/**
 * Accepting and rejecting proposals — **the boundary a human crosses**
 * ([ADR-0005](../../../../../../docs/adr/0005-copilot-authority-model.md) §5).
 *
 * Three rules the implementation exists to hold:
 *
 * - **You may accept what you could have proposed.** Permission is checked by
 *   re-resolving the *capability profile* and requiring the proposal's own tool
 *   to still be offered to the decider. That reuses one mechanism instead of
 *   inventing a second permission model for proposals — and it means a viewer
 *   cannot rubber-stamp a content edit, a revoked role stops mattering
 *   immediately, and a tool an admin later disables becomes un-acceptable for
 *   free.
 * - **Applying runs the ordinary use-case.** This service never writes the
 *   change itself; it hands the proposal to the plugin that owns it. Same
 *   validation, same revision, same activity row, with the human as actor.
 * - **The status flips first, and only once.** `decide` updates with a
 *   `status = 'pending'` predicate, so two reviewers clicking Accept
 *   simultaneously cannot both reach the applier. On a failure the row is
 *   returned to `pending` with the message recorded, so the change is retryable
 *   rather than silently lost.
 */
@Injectable()
export class DecideProposalService {
    private readonly logger = new Logger(DecideProposalService.name);

    constructor(
        private readonly proposals: ProposalRepository,
        private readonly profiles: CapabilityProfileService,
        private readonly appliers: ProposalApplierRegistry
    ) {}

    /** Accepts a proposal, applying it through its owning plugin. */
    async accept(id: string, by: Decider): Promise<DecisionOutcome> {
        const proposal = await this.proposals.find(id, by.workspaceId);
        if (!proposal) {
            return refuse('not-found', 'No such proposal.');
        }
        if (proposal.status !== 'pending') {
            return refuse(
                'already-decided',
                `This proposal was already ${proposal.status}.`
            );
        }

        const permitted = await this.mayDecide(proposal, by);
        if (!permitted) {
            return refuse(
                'not-permitted',
                'You are not permitted to apply this change.'
            );
        }

        const applier = this.appliers.get(proposal.kind);
        if (!applier) {
            // A wiring bug rather than a user error, so it is logged loudly and
            // the proposal is left pending — the change is still valid, and it
            // becomes applicable again the moment the binder is fixed.
            this.logger.error(
                `No applier registered for proposal kind "${proposal.kind}"; ` +
                    `proposal ${proposal.id} cannot be applied.`
            );
            return refuse(
                'no-applier',
                'This kind of change cannot be applied by this deployment.'
            );
        }

        return this.applyThroughOwner(proposal, applier, by);
    }

    /** Rejects a proposal. Nothing is written beyond the decision itself. */
    async reject(id: string, by: Decider): Promise<DecisionOutcome> {
        const proposal = await this.proposals.find(id, by.workspaceId);
        if (!proposal) {
            return refuse('not-found', 'No such proposal.');
        }
        if (proposal.status !== 'pending') {
            return refuse(
                'already-decided',
                `This proposal was already ${proposal.status}.`
            );
        }
        // Rejecting is gated on the same rule as accepting. It looks harmless —
        // nothing is written — but discarding someone's pending change is still
        // a decision about content, and a viewer should not get to make it.
        if (!(await this.mayDecide(proposal, by))) {
            return refuse(
                'not-permitted',
                'You are not permitted to decide on this change.'
            );
        }

        const decided = await this.proposals.decide(
            id,
            by.workspaceId,
            'rejected',
            by.userId
        );
        return decided
            ? { ok: true, proposal: decided }
            : refuse('already-decided', 'This proposal was already decided.');
    }

    /**
     * Accepts and applies **without** the permission re-check, for the run
     * engine's auto-apply path.
     *
     * The check is skipped because it already happened, twice: the capability
     * profile offered the tool at the start of the run, and `executeTool`
     * re-authorized it against a freshly resolved session immediately before
     * the proposal existed. Re-resolving a third time in the same millisecond
     * would only add a query.
     */
    async autoApply(
        proposal: ProposalView,
        by: { userId: string; email: string; workspaceId: string }
    ): Promise<DecisionOutcome> {
        const applier = this.appliers.get(proposal.kind);
        if (!applier) {
            this.logger.error(
                `No applier registered for proposal kind "${proposal.kind}"; ` +
                    `auto-apply of proposal ${proposal.id} skipped.`
            );
            return refuse(
                'no-applier',
                'This kind of change cannot be applied by this deployment.'
            );
        }
        return this.applyThroughOwner(proposal, applier, by);
    }

    /**
     * Flips the status, then hands the change to its owner.
     *
     * The order matters: the `pending` predicate on the update is what makes
     * the apply happen at most once, so it has to win the race *before* the
     * write runs. A failure afterwards returns the row to `pending` with the
     * reason, which is recoverable; the alternative — apply first, record
     * after — can apply twice.
     */
    private async applyThroughOwner(
        proposal: ProposalView,
        applier: ProposalApplier,
        by: { userId: string; email: string; workspaceId: string }
    ): Promise<DecisionOutcome> {
        const claimed = await this.proposals.decide(
            proposal.id,
            by.workspaceId,
            'accepted',
            by.userId
        );
        if (!claimed) {
            return refuse(
                'already-decided',
                'This proposal was already decided.'
            );
        }

        try {
            const result = await applier.apply(
                { target: proposal.target, patch: proposal.patch },
                {
                    userId: by.userId,
                    actorEmail: by.email,
                    workspaceId: by.workspaceId,
                    runId: proposal.runId
                }
            );

            // A second write rather than folding the result into the status
            // transition: that transition only matches a `pending` row, and
            // this one is now `accepted` by design — the claim is what makes
            // the apply happen at most once.
            const finished = await this.proposals.recordResult(
                proposal.id,
                by.workspaceId,
                { ...result }
            );
            return { ok: true, proposal: finished ?? claimed };
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : 'The change could not be applied.';
            this.logger.warn(
                `Applying proposal ${proposal.id} (${proposal.kind}) failed: ${message}`
            );
            await this.proposals.reopen(proposal.id, by.workspaceId, message);
            return refuse('apply-failed', message);
        }
    }

    /** Whether `by` is currently offered the tool that produced `proposal`. */
    private async mayDecide(
        proposal: ProposalView,
        by: Decider
    ): Promise<boolean> {
        const { profile } = await this.profiles.resolve(
            { id: by.userId, email: by.email, roleId: by.roleId },
            by.workspaceId
        );
        return profile.tools.some((tool) => tool.name === proposal.toolName);
    }
}

/** A refusal, with the message the route turns into a 4xx body. */
function refuse(reason: DecisionRefusal, message: string): DecisionOutcome {
    return { ok: false, reason, message };
}
