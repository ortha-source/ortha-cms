import type {
    EntryAccessDescription,
    EntryAccessSourceRegistry
} from '@orthacms/content-server';

/** What the `access` field resolves to when nothing narrows a read. */
const OPEN: EntryAccessDescription = { restricted: false, dimensions: [] };

/**
 * Batches the `access` labels of every entry an execution touches into one call
 * per tick.
 *
 * Same shape and same reason as {@link EntryLoader}: a document resolves a page
 * of entries and then asks each of them whether it was reader-scoped, so a
 * per-entry lookup would be an N+1 against a table the read itself already
 * consulted. Requests are collected across the microtask queue and dispatched
 * once, exactly as the entry batches are.
 *
 * With **no source registered** it never dispatches at all: `active` is false,
 * every load resolves to {@link OPEN} synchronously, and an installation with no
 * scoping plugin pays nothing for a field it will always answer the same way.
 * That is deliberate — the field is on every entry type in every schema, so its
 * cost when unused is the cost every deployment pays.
 */
export class AccessLoader {
    /** Ids awaiting dispatch, and the promise that will carry their answers. */
    private pending: {
        ids: Set<string>;
        result: Promise<ReadonlyMap<string, EntryAccessDescription>>;
    } | null = null;

    constructor(
        private readonly registry: EntryAccessSourceRegistry | undefined,
        private readonly workspaceId: string
    ) {}

    /**
     * The access label of one entry, joining the batch forming this tick.
     *
     * An id the sources did not describe reads as {@link OPEN}. That is the
     * same default absence carries throughout this feature — an entry with no
     * projection is unrestricted — and it is the only reading that stays
     * correct as sources come and go.
     */
    load(entryId: string): Promise<EntryAccessDescription> {
        if (!this.registry?.active) {
            return Promise.resolve(OPEN);
        }
        if (!this.pending) {
            const pending: {
                ids: Set<string>;
                result?: Promise<ReadonlyMap<string, EntryAccessDescription>>;
            } = { ids: new Set() };
            // Dispatch once the current microtask queue has drained, so every
            // sibling resolver has had its turn to enqueue — the same
            // `Promise.resolve().then(nextTick)` ordering the entry loader uses,
            // for the same reason.
            pending.result = Promise.resolve()
                .then(() => new Promise(process.nextTick))
                .then(() => this.dispatch());
            this.pending = pending as {
                ids: Set<string>;
                result: Promise<ReadonlyMap<string, EntryAccessDescription>>;
            };
        }
        this.pending.ids.add(entryId);
        return this.pending.result.then((byId) => byId.get(entryId) ?? OPEN);
    }

    /** Runs the accumulated batch. */
    private async dispatch(): Promise<
        ReadonlyMap<string, EntryAccessDescription>
    > {
        const batch = this.pending;
        this.pending = null;
        if (!batch || !this.registry) {
            return new Map();
        }
        return this.registry.describe({
            workspaceId: this.workspaceId,
            entryIds: [...batch.ids]
        });
    }
}
