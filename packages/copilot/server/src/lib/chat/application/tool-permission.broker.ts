import { Injectable, Logger } from '@nestjs/common';
import type { ToolPermissionDecision } from '@ortha-cms/copilot-domain';

/**
 * How long a parked run waits for an answer before giving up.
 *
 * The SSE stream heartbeats every 15s, so the connection itself will survive
 * far longer than this — the limit is about the user, not the socket. Five
 * minutes is "they went to look at the entry and came back"; beyond that they
 * have walked away, and a generator holding a model context open for an answer
 * nobody is coming back to give is just cost.
 */
const DECISION_TIMEOUT_MS = 5 * 60_000;

/** A decision, plus how it was reached — the timeout is not a user's `deny`. */
export interface PermissionOutcome {
    decision: ToolPermissionDecision;
    /** True when nobody answered in time. */
    timedOut: boolean;
}

/**
 * Parks a run while its user decides whether one tool call may proceed.
 *
 * **In-memory, and that is a real deployment constraint, not an oversight.**
 * The promise a run awaits lives in this process, so the `POST …/permission`
 * that resolves it has to reach the same instance. A single-node self-hosted
 * CMS — which is what this is — is fine. A horizontally scaled one needs sticky
 * routing by `runId`, or this registry moved behind a shared channel. Say so in
 * the deployment notes rather than discovering it as an occasional hang.
 *
 * Three things it has to get right, all of which are ways a run could otherwise
 * be stranded forever:
 *
 * - **A timeout.** Documented above. It resolves as a refusal rather than
 *   throwing, so the model is told and the answer still lands.
 * - **Abort.** The user closing the window is the common case, and the engine's
 *   `signal` fires; the waiter has to reject then, or the generator never
 *   unwinds and the run leaks.
 * - **Cleanup.** Every exit path clears the entry. A registry that only deletes
 *   on the happy path grows one dangling promise per abandoned run.
 */
@Injectable()
export class ToolPermissionBroker {
    private readonly logger = new Logger(ToolPermissionBroker.name);

    /** Waiters by `runId:callId`. */
    private readonly waiting = new Map<
        string,
        (outcome: PermissionOutcome) => void
    >();

    /**
     * Waits for the user's answer to one call.
     *
     * Resolves rather than rejects on a timeout, because a refusal is an
     * ordinary tool error the model can report — the same treatment every other
     * refused call gets. Only an abort rejects, and only because that means
     * nobody is listening any more.
     */
    async ask(
        runId: string,
        callId: string,
        signal: AbortSignal
    ): Promise<PermissionOutcome> {
        const key = `${runId}:${callId}`;
        return new Promise<PermissionOutcome>((resolve, reject) => {
            const settle = (outcome: PermissionOutcome) => {
                cleanup();
                resolve(outcome);
            };
            const timer = setTimeout(() => {
                this.logger.warn(
                    `Run ${runId}: nobody answered the permission request for ` +
                        `call ${callId} within ${DECISION_TIMEOUT_MS}ms; refusing.`
                );
                settle({ decision: 'deny', timedOut: true });
            }, DECISION_TIMEOUT_MS);
            const onAbort = () => {
                cleanup();
                reject(signal.reason ?? new Error('aborted'));
            };
            const cleanup = () => {
                clearTimeout(timer);
                signal.removeEventListener('abort', onAbort);
                this.waiting.delete(key);
            };

            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener('abort', onAbort, { once: true });
            this.waiting.set(key, settle);
        });
    }

    /**
     * Delivers a decision. Returns false when nothing was waiting — an answer
     * that arrived after the timeout, or for a run on another instance, and the
     * route turns that into a 404 rather than pretending it landed.
     */
    decide(
        runId: string,
        callId: string,
        decision: ToolPermissionDecision
    ): boolean {
        const key = `${runId}:${callId}`;
        const settle = this.waiting.get(key);
        if (!settle) {
            return false;
        }
        settle({ decision, timedOut: false });
        return true;
    }
}
