import { useCallback } from 'react';
import type {
    BulkPublishResult,
    BulkPublishVerdict
} from '../../domain/types/contentType';
import { BULK_VERDICT } from '../../domain/constants';
import { useBulkEntryActions } from '../useBulkEntryActions';

/** What {@link useBulkPublishFlow} exposes to the bulk-publish dialog. */
export type BulkPublishFlow = {
    /** Dry-run each id server-side (validates, writes nothing) for the given set. */
    preview: (ids: string[]) => void;
    /** Clear the last dry-run (on dialog close). */
    resetPreview: () => void;
    /** The per-id verdicts from the last dry-run, in request order. */
    verdicts: BulkPublishVerdict[];
    /** How many of the previewed records will actually publish. */
    publishableCount: number;
    /** Whether the dry-run is in flight. */
    isPreviewing: boolean;
    /** Whether the dry-run failed. */
    isPreviewError: boolean;
    /**
     * Commit the publish over `ids` — the server re-validates and publishes only
     * the valid drafts, returning the {@link BulkPublishResult} partial-success
     * shape (`published` ids + `skipped` with reasons). Resolves with that result;
     * rejects on transport failure.
     */
    commit: (ids: string[]) => Promise<BulkPublishResult>;
    /** Whether the commit is in flight. */
    isPublishing: boolean;
};

/**
 * The **bulk-publish use case**: a dry-run pre-flight over a selection, then a
 * commit that publishes only the valid drafts. Wraps the bulk mutations so the
 * dialog renders the flow's verdicts + partial-success result instead of wiring
 * two mutations together itself. The verdicts and the commit result mirror the
 * server's own partial-success shape one-for-one, so nothing is re-derived here.
 */
export function useBulkPublishFlow(typeName: string): BulkPublishFlow {
    const { previewPublish, publish } = useBulkEntryActions(typeName);
    const { mutate: runPreview, reset: resetPreview } = previewPublish;

    const preview = useCallback(
        (ids: string[]) => runPreview(ids),
        [runPreview]
    );

    const commit = useCallback(
        (ids: string[]) => publish.mutateAsync(ids),
        [publish]
    );

    const verdicts = previewPublish.data?.items ?? [];
    const publishableCount = verdicts.filter(
        (verdict) => verdict.verdict === BULK_VERDICT.Publishable
    ).length;

    return {
        preview,
        resetPreview,
        verdicts,
        publishableCount,
        isPreviewing: previewPublish.isPending,
        isPreviewError: previewPublish.isError,
        commit,
        isPublishing: publish.isPending
    };
}
