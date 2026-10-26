import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, HTTP_STATUS } from '@orthacms/utils-admin';
import { httpActivityGateway } from '../../infrastructure/httpActivityGateway';
import { activityKeys } from '../../infrastructure/activityKeys';

/** What a "Retry all" pass did, row by row. */
export type RetryAllOutcome = {
    /** Ids the server reset and queued. */
    queued: string[];
    /** Ids the server answered 404/409 for — no longer parked. */
    gone: string[];
    /**
     * Ids never sent, because an earlier one failed for another reason (a
     * 5xx, a lost permission). Stopping is the point: whatever broke the first
     * request will break the next forty-nine.
     */
    skipped: string[];
    /** The error that stopped the pass, if one did. */
    error: unknown;
};

/**
 * Retries the given parked events **one at a time, in order**, and stops at the
 * first refusal that is not "already gone".
 *
 * Sequential on purpose. There is no bulk route and this does not fake one: a
 * reset row goes back to the head of the dispatcher's `ORDER BY occurred_at`
 * claim, and the retry route awaits its own drain before it answers — so one
 * request at a time means each event is attempted before the next is reset,
 * rather than fifty rows landing on the queue's head at once. And the ids are
 * the ones the operator is **looking at** in the dialog, never "everything
 * parked": the dialog shows a capped page of an unbounded `total`, and a bulk
 * action must not reach rows nobody has seen.
 *
 * Pure apart from `retryOne`, so the stopping rule is unit-tested.
 */
export async function retrySequentially(
    ids: readonly string[],
    retryOne: (id: string) => Promise<unknown>,
    onEach?: (id: string) => void
): Promise<RetryAllOutcome> {
    const outcome: RetryAllOutcome = {
        queued: [],
        gone: [],
        skipped: [],
        error: null
    };
    for (const [index, id] of ids.entries()) {
        onEach?.(id);
        try {
            await retryOne(id);
            outcome.queued.push(id);
        } catch (error) {
            const status = error instanceof ApiError ? error.status : null;
            if (
                status === HTTP_STATUS.NOT_FOUND ||
                status === HTTP_STATUS.CONFLICT
            ) {
                outcome.gone.push(id);
                continue;
            }
            outcome.error = error;
            outcome.skipped.push(...ids.slice(index + 1));
            break;
        }
    }
    return outcome;
}

/** What {@link useRetryAllDeadLetters} is called with. */
export type RetryAllInput = {
    /** The parked events shown in the dialog, newest first. */
    ids: readonly string[];
    /** Told which id is being sent, so its row can show a spinner. */
    onEach?: (id: string) => void;
};

/**
 * "Retry all" in the dead-letter dialog — {@link retrySequentially} over the
 * rows on screen, then **one** refresh of the dead-letter list (both cache
 * entries, `deadLettersRoot`), not one per row. Like the single retry, it does
 * not touch the log list: nothing has been delivered yet.
 *
 * Needs `activity:manage`; the caller renders the control only for a reader
 * who holds it.
 */
export function useRetryAllDeadLetters() {
    const queryClient = useQueryClient();

    return useMutation<RetryAllOutcome, Error, RetryAllInput>({
        mutationFn: ({ ids, onEach }) =>
            retrySequentially(
                ids,
                (id) => httpActivityGateway.retryDeadLetter(id),
                onEach
            ),
        onSettled: () => {
            void queryClient.invalidateQueries({
                queryKey: activityKeys.deadLettersRoot
            });
        }
    });
}
