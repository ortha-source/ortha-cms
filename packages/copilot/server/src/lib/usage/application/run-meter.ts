import { Logger } from '@nestjs/common';
import {
    billableTokens,
    type ModelUsage,
    type RunStopReason
} from '@orthacms/copilot-domain';
import type { UsageRepository } from '../infrastructure/persistence/usage.repository';

/** The thread and backend a run is charged against, once known. */
export interface MeterNames {
    conversationId?: string;
    provider?: string;
    model?: string;
}

/**
 * One admitted run's handle on the spend ledger.
 *
 * Created by `CopilotQuotaService.begin`, which has already written the run's
 * `running` row; the engine reports each model call to it and asks it whether
 * the daily budget still has room between steps.
 *
 * **A ledger write never fails a run.** The person is watching an answer
 * arrive, and the tokens are already spent at the provider: refusing to
 * show the rest because a bookkeeping `UPDATE` failed would cost them the
 * answer and save nothing. Failures are logged, loudly.
 */
export class RunMeter {
    private readonly logger = new Logger(RunMeter.name);
    private spent = 0;
    private named = false;

    constructor(
        /** The run this meter charges — the engine uses it as its run id. */
        readonly runId: string,
        /**
         * Billable tokens the run may spend before it is stopped with
         * `quota` — `Infinity` when no daily quota is set.
         */
        readonly budget: number,
        private readonly ledger: UsageRepository,
        private readonly clock: () => Date = () => new Date()
    ) {}

    /** Billable tokens this run has spent so far. */
    get spentTokens(): number {
        return this.spent;
    }

    /** Whether the daily budget this run was admitted with is spent. */
    get exhausted(): boolean {
        return this.spent >= this.budget;
    }

    /**
     * Charges one model call. `names` is written the first time it is passed
     * and ignored afterwards — the thread and backend do not change mid-run.
     */
    async record(usage: ModelUsage, names: MeterNames = {}): Promise<void> {
        this.spent += billableTokens(usage);
        const firstNames = this.named ? {} : names;
        this.named = this.named || Object.keys(names).length > 0;
        try {
            await this.ledger.record(
                this.runId,
                usage,
                this.clock(),
                firstNames
            );
        } catch (error) {
            this.logger.error(
                `Could not record usage for copilot run ${this.runId}`,
                error instanceof Error ? error.stack : String(error)
            );
        }
    }

    /** Closes the run's row. Safe to call once, from the engine's `finally`. */
    async finish(stopReason: RunStopReason): Promise<void> {
        try {
            await this.ledger.finish(this.runId, stopReason, this.clock());
        } catch (error) {
            this.logger.error(
                `Could not close the usage row for copilot run ${this.runId}`,
                error instanceof Error ? error.stack : String(error)
            );
        }
    }
}
