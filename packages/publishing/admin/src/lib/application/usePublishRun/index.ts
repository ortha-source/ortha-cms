import { useCallback, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    BULK_VERDICT,
    commitBulkPublish,
    previewBulkPublish,
    refreshEntryCaches,
    type BulkPublishVerdict,
    type BulkVerdictKind
} from '@orthacms/content-admin';
import type { PublishBatch } from '../../domain/publishPicks';

/** What a committed entry came to. */
export type PublishOutcome =
    | { kind: 'published' }
    | { kind: 'skipped'; reason: BulkVerdictKind };

/** The result of one commit over a set of batches. */
export type PublishRunResult = {
    /** Per entry id that was sent. */
    outcomes: ReadonlyMap<string, PublishOutcome>;
    /** Batches that never got an answer (transport failure), in order. */
    failed: PublishBatch[];
};

/** What {@link usePublishRun} exposes to the page. */
export type PublishRun = {
    /** Dry-run every batch; resolves when all have answered. */
    check: (batches: PublishBatch[]) => Promise<void>;
    /** The verdicts of the last check, per entry id. */
    verdicts: ReadonlyMap<string, BulkPublishVerdict>;
    isChecking: boolean;
    /** The last check did not complete. */
    checkFailed: boolean;
    /** Forget the last check (the picks changed under it). */
    resetCheck: () => void;
    /**
     * Commit every batch, in order — dependencies first, as `publishBatches`
     * orders them — sending only the entries the last check found publishable.
     */
    commit: (batches: PublishBatch[]) => Promise<PublishRunResult>;
    isCommitting: boolean;
    /** The last commit's result, until the next check. */
    result: PublishRunResult | null;
};

/**
 * The Publish Manager's **use case**: a dry run per type, then a commit per
 * type, over content's own bulk-publish endpoints — so validation, publish
 * guards and partial success are exactly a plain bulk publish's.
 *
 * Batches run **one after another**, never in parallel: a commit takes row
 * locks, and the order is the point (linked drafts before the records that
 * link to them). A batch that fails in transport stops the run there and is
 * reported with everything after it, rather than skipped past — publishing the
 * article after its author's batch failed is exactly what the order prevents.
 *
 * After a commit every touched type's caches are refreshed once
 * (`refreshEntryCaches`), and `onCommitted` lets the page re-read the set.
 */
export function usePublishRun(
    workspaceId: string,
    onCommitted: () => void
): PublishRun {
    const queryClient = useQueryClient();
    const [verdicts, setVerdicts] = useState<
        ReadonlyMap<string, BulkPublishVerdict>
    >(new Map());
    const [result, setResult] = useState<PublishRunResult | null>(null);

    const checkMutation = useMutation({
        mutationFn: async (batches: PublishBatch[]) => {
            const next = new Map<string, BulkPublishVerdict>();
            for (const batch of batches) {
                const preview = await previewBulkPublish(batch.type, batch.ids);
                for (const item of preview.items) next.set(item.id, item);
            }
            return next;
        },
        onSuccess: (next) => {
            setVerdicts(next);
            setResult(null);
        }
    });

    const commitMutation = useMutation({
        mutationFn: async (
            batches: PublishBatch[]
        ): Promise<PublishRunResult> => {
            const outcomes = new Map<string, PublishOutcome>();
            const touched = new Set<string>();
            const failed: PublishBatch[] = [];
            for (const [index, batch] of batches.entries()) {
                const ids = batch.ids.filter(
                    (id) =>
                        verdicts.get(id)?.verdict === BULK_VERDICT.Publishable
                );
                if (!ids.length) continue;
                try {
                    const committed = await commitBulkPublish(batch.type, ids);
                    touched.add(batch.type);
                    for (const id of committed.published) {
                        outcomes.set(id, { kind: 'published' });
                    }
                    for (const skip of committed.skipped) {
                        outcomes.set(skip.id, {
                            kind: 'skipped',
                            reason: skip.reason
                        });
                    }
                } catch {
                    failed.push(...batches.slice(index));
                    break;
                }
            }
            await Promise.all(
                [...touched].map((type) =>
                    refreshEntryCaches(queryClient, workspaceId, type)
                )
            );
            return { outcomes, failed };
        },
        onSuccess: (next) => {
            setResult(next);
            setVerdicts(new Map());
            onCommitted();
        }
    });

    const resetCheck = useCallback(() => {
        setVerdicts(new Map());
        checkMutation.reset();
    }, [checkMutation]);

    return {
        check: async (batches) => {
            await checkMutation.mutateAsync(batches);
        },
        verdicts,
        isChecking: checkMutation.isPending,
        checkFailed: checkMutation.isError,
        resetCheck,
        commit: (batches) => commitMutation.mutateAsync(batches),
        isCommitting: commitMutation.isPending,
        result
    };
}
