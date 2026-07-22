import type { UploadStatus } from '../../constants';

/**
 * One file in the upload queue — the view model the progress banner renders.
 * The `File` itself is **not** here: it lives in the queue hook's ref map, so a
 * progress tick re-renders a small serializable row instead of dragging a blob
 * through React state.
 */
export type UploadItem = {
    /** Queue-local id (files have no stable identity of their own). */
    id: string;
    name: string;
    /** Bytes, used both for display and to weight the batch percentage. */
    size: number;
    /** Whole-number percent of bytes sent, 0–100. */
    progress: number;
    status: UploadStatus;
    /** Localized failure reason; set only when `status` is `failed`. */
    error?: string;
};

/** The batch roll-up the banner headline reads from. */
export type UploadSummary = {
    /** Every item still pending or uploading. */
    inFlight: number;
    done: number;
    failed: number;
    /** Items in the batch, excluding cancelled ones. */
    total: number;
    /**
     * Whole-number percent across the batch, **weighted by file size** — ten
     * thumbnails finishing shouldn't read as 90% while a 200 MB video is still
     * going.
     */
    percent: number;
    /** True while anything is pending or uploading. */
    active: boolean;
};
