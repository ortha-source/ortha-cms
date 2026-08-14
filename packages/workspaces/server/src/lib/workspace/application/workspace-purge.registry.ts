import { Injectable, Logger } from '@nestjs/common';
import type {
    WorkspacePurger,
    WorkspacePurgeOutcome
} from './ports/workspace-purger.port';

/** What a full purge removed, per contributor. */
export interface WorkspacePurgeReport {
    /** Rows removed, keyed by {@link WorkspacePurger.purgeName}. */
    rowsByPurger: Record<string, number>;
    /** Total rows removed across every contributor. */
    total: number;
}

/**
 * Every plugin's contribution to "what else belongs to this workspace", and the
 * one place a workspace delete reaches them.
 *
 * See {@link WorkspacePurger} for why the cross-plugin rows need this at all and
 * why registration is a call rather than a DI multi-binding.
 *
 * **Order is registration order and must not be depended on.** Purgers clean up
 * rows in *different* plugins with no foreign keys between them, so there is
 * nothing for an ordering to satisfy; if two ever did have a dependency, the
 * fix is a foreign key inside that plugin, not a sequence here.
 */
@Injectable()
export class WorkspacePurgeRegistry {
    private readonly logger = new Logger(WorkspacePurgeRegistry.name);
    private readonly purgers: WorkspacePurger[] = [];

    /**
     * Add a contributor. Called by each plugin from `onModuleInit`.
     *
     * A duplicate `purgeName` is a **wiring bug** — two registrations of the
     * same purger would double-count the report and run its reclaim twice — so
     * it throws here rather than resolving silently.
     */
    register(purger: WorkspacePurger): void {
        if (this.purgers.some((it) => it.purgeName === purger.purgeName)) {
            throw new Error(
                `Duplicate workspace purger "${purger.purgeName}" — each plugin registers once.`
            );
        }
        this.purgers.push(purger);
    }

    /** The registered contributors, in registration order. */
    get registered(): readonly string[] {
        return this.purgers.map((purger) => purger.purgeName);
    }

    /**
     * Run every purger against `workspaceId`, **inside the caller's
     * transaction**, and return what they removed plus the deferred cleanup.
     *
     * Serial rather than concurrent: they share one transaction, and a
     * `UnitOfWork` transaction is a single connection that cannot interleave
     * statements from parallel callers.
     *
     * A throwing purger propagates, aborting the delete. That is deliberate —
     * "most of the workspace was deleted" is precisely the orphaning this
     * exists to prevent, so the whole thing must roll back.
     */
    async purgeAll(workspaceId: string): Promise<{
        report: WorkspacePurgeReport;
        reclaim: () => Promise<void>;
    }> {
        const rowsByPurger: Record<string, number> = {};
        const outcomes: WorkspacePurgeOutcome[] = [];

        for (const purger of this.purgers) {
            const outcome = await purger.purge(workspaceId);
            rowsByPurger[purger.purgeName] = outcome.rows;
            outcomes.push(outcome);
        }

        const total = Object.values(rowsByPurger).reduce(
            (sum, rows) => sum + rows,
            0
        );

        return {
            report: { rowsByPurger, total },
            reclaim: () => this.reclaimAll(workspaceId, outcomes)
        };
    }

    /**
     * Run the deferred, non-transactional cleanup. Called after the commit.
     *
     * Each failure is logged and swallowed: the rows are gone and committed, so
     * throwing would report a failed delete that actually succeeded, and leave
     * the caller with nothing useful to retry. What is left behind is
     * unreferenced bytes — a garbage-collection problem, not a correctness one,
     * and the log line is what a sweep would be built from.
     */
    private async reclaimAll(
        workspaceId: string,
        outcomes: WorkspacePurgeOutcome[]
    ): Promise<void> {
        await Promise.all(
            outcomes.map(async (outcome, index) => {
                if (!outcome.reclaim) {
                    return;
                }
                try {
                    await outcome.reclaim();
                } catch (error) {
                    this.logger.error(
                        `Post-commit reclaim failed for purger "${this.purgers[index]?.purgeName}" on workspace ${workspaceId}; its rows are deleted but external resources may remain.`,
                        error instanceof Error ? error.stack : String(error)
                    );
                }
            })
        );
    }
}
