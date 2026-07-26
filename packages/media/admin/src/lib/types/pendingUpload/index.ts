/**
 * One file staged on a media field and **not yet uploaded** — the record is
 * saved first, and only then do the bytes move (see `usePendingMediaUploads`).
 */
export type PendingUpload = {
    /**
     * The placeholder id standing in for the asset in the form value. A real
     * uuid on purpose: the shared kernel validates a media value as a uuid (or
     * uuid[]), so a staged file satisfies client validation and the publish gate
     * exactly like an attached asset would.
     */
    id: string;
    /** The bytes to send when the record is saved. */
    file: File;
    /** Object URL for an image preview; revoked when the entry is dropped. */
    previewUrl?: string;
    /**
     * The real asset id, once this file has been uploaded. Set when a save's
     * upload step succeeded but the write behind it did not — so a retry attaches
     * the asset already in the library instead of uploading it a second time.
     */
    uploadedId?: string;
};

/**
 * What a media field needs in order to stage files — the handle
 * `usePendingMediaUploads` publishes through the entry editor's presave slot, so
 * the staging outlives the Media tab's body (tabs are routes; the panel unmounts
 * on every tab switch).
 */
export type MediaPendingUploads = {
    /** Every staged file, keyed by its placeholder id. */
    pending: ReadonlyMap<string, PendingUpload>;
    /** Stage files and return their placeholder ids, in order. */
    stage: (files: File[]) => string[];
    /** Forget one staged file (removing it from a field also drops it here). */
    drop: (id: string) => void;
};
