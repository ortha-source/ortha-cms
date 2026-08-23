/**
 * Raised by a {@link StorageProvider} when the bytes behind a storage key are
 * gone — the row exists, the blob does not.
 *
 * The port already promises that `get` "rejects if the key is gone", so the
 * *kind* of rejection belongs to the port rather than to a filesystem. Without
 * it the raw driver error escaped: `provider-local` rejected with a node
 * `ENOENT`, nothing mapped it, and `GET /media/assets/:id/raw` answered **500**
 * for a database restored against an empty volume, a blob reclaimed by hand, or
 * an interrupted migration.
 *
 * It maps to a **404**, deliberately. From the caller's side a missing blob is
 * indistinguishable from a missing asset, and the route already answers 404 for
 * a non-existent id and for a non-member — the same code on purpose, so nobody
 * can probe which ids exist. A 500 for the third case was both wrong and a
 * signal: it told an unauthorized-ish caller that the row was real.
 *
 * Provider-agnostic: `provider-local` raises it for `ENOENT`, and
 * `provider-s3` will raise it for `NoSuchKey`.
 */
export class ObjectNotFoundError extends Error {
    constructor(
        /** The key whose object is missing. Never shown to a caller. */
        readonly storageKey: string,
        /**
         * The underlying driver error, kept for the operator's log line —
         * the standard `Error.cause`, so a stack printer shows it.
         */
        cause?: unknown
    ) {
        super(`No stored object for key: ${storageKey}`, { cause });
        this.name = 'ObjectNotFoundError';
    }
}
