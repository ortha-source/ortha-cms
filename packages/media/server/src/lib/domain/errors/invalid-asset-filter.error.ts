/**
 * Raised when an asset listing is asked to filter on a value the column cannot
 * hold — a `folderId` that is not a uuid, or a `kind` outside `media_kind`.
 *
 * It exists so the listing rejects the value itself rather than handing it to
 * Postgres: `eq(mediaAsset.folderId, 'not-a-uuid')` came back as a driver-level
 * `invalid input syntax for type uuid`, which surfaced as a **500** for what is
 * plainly a bad request. Transport-agnostic, so both callers of the query — the
 * HTTP route and the agent tool — get something they can map.
 */
export class InvalidAssetFilterError extends Error {
    constructor(
        /** The rejected filter's name, e.g. `folderId`. */
        readonly filter: string,
        message: string
    ) {
        super(message);
        this.name = 'InvalidAssetFilterError';
    }
}
