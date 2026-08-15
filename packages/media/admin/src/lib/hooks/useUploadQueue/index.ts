import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { UPLOAD_CONCURRENCY, UPLOAD_STATUS } from '../../constants';
import type { UploadItem, UploadSummary } from '../../types/upload';
import { httpMediaGateway } from '../../infrastructure/httpMediaGateway';
import { apiMessage } from '../../infrastructure/apiMessage';
import type { StagedUpload } from '../../infrastructure/mediaGateway';

/** Intl descriptor for an upload failure with no server-supplied reason. */
const messages = defineMessages({
    failed: {
        id: 'media.upload.failed',
        defaultMessage: 'Upload failed'
    }
});

/** Statuses that are over — the ones "Dismiss" clears. */
const SETTLED: readonly string[] = [
    UPLOAD_STATUS.Done,
    UPLOAD_STATUS.Failed,
    UPLOAD_STATUS.Cancelled
];

/**
 * The Media Library's upload queue: turns a set of picked files into a list of
 * progress-tracked items, uploading at most {@link UPLOAD_CONCURRENCY} at once.
 *
 * Each file is **its own request** (the gateway is one-file-per-call), so one
 * rejection fails exactly one row and leaves the rest of the batch running —
 * the old `Promise.all` lost the whole batch to a single bad file. Failed rows
 * are individually retryable; in-flight ones are cancellable through an
 * `AbortController`.
 *
 * The `File` objects and the runner's bookkeeping live in refs, not state: a
 * progress event fires many times a second per file, and only the small
 * {@link UploadItem} rows belong in a re-render.
 *
 * @param folderId - destination folder, captured **per file at enqueue time**
 *   so navigating away mid-upload can't redirect in-flight files to a folder
 *   the user merely happens to be looking at.
 * @param onUploaded - called once per settled batch that may have changed the
 *   library (the caller invalidates its queries there — once, not per file).
 *   That includes a **cancelled** file: an abort only stops the client, so a
 *   body the server already finished reading is committed either way.
 */
export function useUploadQueue(folderId: string, onUploaded: () => void) {
    const intl = useIntl();
    const [items, setItems] = useState<UploadItem[]>([]);

    // --- Runner bookkeeping (refs: mutated mid-flight, never rendered) --------
    /** id → the file to send, its description, and the folder it was queued for. */
    const filesRef = useRef(
        new Map<string, { file: File; alt?: string; folderId: string }>()
    );
    /** id → abort handle, present only while that file is on the wire. */
    const abortsRef = useRef(new Map<string, AbortController>());
    /** Ids waiting for a slot, oldest first. */
    const waitingRef = useRef<string[]>([]);
    const activeRef = useRef(0);
    /** Whether the current batch has produced a success worth invalidating for. */
    const successRef = useRef(false);
    const nextIdRef = useRef(0);

    // `pump` and `runOne` call each other; the ref breaks the cycle without
    // rebuilding either callback on every render.
    const runOneRef = useRef<(id: string) => void>(() => undefined);
    const onUploadedRef = useRef(onUploaded);
    useEffect(() => {
        onUploadedRef.current = onUploaded;
    }, [onUploaded]);

    const patch = useCallback((id: string, next: Partial<UploadItem>) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, ...next } : item))
        );
    }, []);

    /** Fills every free slot, then settles the batch if nothing is left. */
    const pump = useCallback(() => {
        while (
            activeRef.current < UPLOAD_CONCURRENCY &&
            waitingRef.current.length > 0
        ) {
            const id = waitingRef.current.shift();
            if (id) runOneRef.current(id);
        }
        if (activeRef.current === 0 && waitingRef.current.length === 0) {
            if (successRef.current) {
                successRef.current = false;
                onUploadedRef.current();
            }
        }
    }, []);

    const runOne = useCallback(
        (id: string) => {
            const entry = filesRef.current.get(id);
            if (!entry) return;

            const controller = new AbortController();
            abortsRef.current.set(id, controller);
            // Claim the slot synchronously — `pump`'s loop checks this counter
            // again on its very next iteration.
            activeRef.current += 1;
            patch(id, { status: UPLOAD_STATUS.Uploading, progress: 0 });

            void httpMediaGateway
                .uploadFile(entry.folderId, entry.file, {
                    alt: entry.alt,
                    signal: controller.signal,
                    onProgress: (percent) => patch(id, { progress: percent })
                })
                .then(() => {
                    successRef.current = true;
                    patch(id, {
                        status: UPLOAD_STATUS.Done,
                        progress: 100,
                        error: undefined
                    });
                })
                .catch((error: unknown) => {
                    if (controller.signal.aborted) {
                        patch(id, { status: UPLOAD_STATUS.Cancelled });
                        // Cancelling aborts the *client*. If the server had
                        // already received the whole body it commits anyway, so
                        // the asset exists — it was simply never fetched, and
                        // stayed invisible until a manual reload. Refetch on a
                        // cancel too, so the grid tells the truth. (Deleting the
                        // committed asset isn't possible from here: the response
                        // that carries its id is what the abort threw away.)
                        successRef.current = true;
                        return;
                    }
                    patch(id, {
                        status: UPLOAD_STATUS.Failed,
                        progress: 0,
                        // The API's own sentence ("File exceeds the maximum
                        // upload size.") rather than the transport's status
                        // line, which told the author nothing actionable.
                        error:
                            apiMessage(error) ??
                            intl.formatMessage(messages.failed)
                    });
                })
                .finally(() => {
                    abortsRef.current.delete(id);
                    activeRef.current -= 1;
                    pump();
                });
        },
        [intl, patch, pump]
    );
    useEffect(() => {
        runOneRef.current = runOne;
    }, [runOne]);

    /** Queues files for the folder open **now** and starts uploading. */
    const enqueue = useCallback(
        (uploads: StagedUpload[]) => {
            if (uploads.length === 0) return;
            const queued: UploadItem[] = uploads.map(({ file, alt }) => {
                const id = `upload-${nextIdRef.current++}`;
                filesRef.current.set(id, { file, alt, folderId });
                waitingRef.current.push(id);
                return {
                    id,
                    name: file.name,
                    size: file.size,
                    progress: 0,
                    status: UPLOAD_STATUS.Pending
                };
            });
            setItems((prev) => [...prev, ...queued]);
            pump();
        },
        [folderId, pump]
    );

    /** Re-queues one failed or cancelled file. */
    const retry = useCallback(
        (id: string) => {
            if (!filesRef.current.has(id)) return;
            patch(id, {
                status: UPLOAD_STATUS.Pending,
                progress: 0,
                error: undefined
            });
            waitingRef.current.push(id);
            pump();
        },
        [patch, pump]
    );

    /** Aborts an in-flight file, or drops one that hasn't started. */
    const cancel = useCallback(
        (id: string) => {
            const controller = abortsRef.current.get(id);
            if (controller) {
                // The abort rejects the request; `runOne`'s catch marks it.
                controller.abort();
                return;
            }
            waitingRef.current = waitingRef.current.filter(
                (queued) => queued !== id
            );
            patch(id, { status: UPLOAD_STATUS.Cancelled });
        },
        [patch]
    );

    /** Clears every finished row, leaving anything still uploading. */
    const dismissSettled = useCallback(() => {
        setItems((prev) => {
            for (const item of prev) {
                if (SETTLED.includes(item.status)) {
                    filesRef.current.delete(item.id);
                }
            }
            return prev.filter((item) => !SETTLED.includes(item.status));
        });
    }, []);

    // Abort anything still in flight if the library unmounts, so a navigation
    // away doesn't leave orphan requests writing to a dead component.
    useEffect(() => {
        const aborts = abortsRef.current;
        return () => {
            for (const controller of aborts.values()) controller.abort();
        };
    }, []);

    const summary = useMemo<UploadSummary>(() => {
        const counted = items.filter(
            (item) => item.status !== UPLOAD_STATUS.Cancelled
        );
        const totalBytes = counted.reduce((sum, item) => sum + item.size, 0);
        const sentBytes = counted.reduce(
            (sum, item) => sum + (item.size * item.progress) / 100,
            0
        );
        return {
            inFlight: counted.filter(
                (item) =>
                    item.status === UPLOAD_STATUS.Pending ||
                    item.status === UPLOAD_STATUS.Uploading
            ).length,
            done: counted.filter((item) => item.status === UPLOAD_STATUS.Done)
                .length,
            failed: counted.filter(
                (item) => item.status === UPLOAD_STATUS.Failed
            ).length,
            total: counted.length,
            // A zero-byte file would make this 0/0; treat an empty batch as done.
            percent:
                totalBytes === 0
                    ? 100
                    : Math.round((sentBytes / totalBytes) * 100),
            active: counted.some(
                (item) =>
                    item.status === UPLOAD_STATUS.Pending ||
                    item.status === UPLOAD_STATUS.Uploading
            )
        };
    }, [items]);

    return { items, summary, enqueue, retry, cancel, dismissSettled };
}
