import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

/** Who is reading, for the length of one request. */
export interface Reader {
    /** The tags the resolver produced. Empty is the anonymous reader. */
    readonly tags: readonly string[];
    /** Those tags resolved against the catalogue. What the predicate matches. */
    readonly segmentIds: ReadonlySet<string>;
}

/** Nobody — no tags, no segments. */
const ANONYMOUS: Reader = { tags: [], segmentIds: new Set() };

/**
 * The reader of the current request.
 *
 * `AsyncLocalStorage` rather than a request-scoped provider, because the read
 * scope is consulted **inside the query builder**, which is reached from a
 * singleton service with no request in hand. Middleware wraps the rest of the
 * request in `run`, and everything underneath can ask who is reading without
 * that question being threaded through every signature between here and there.
 *
 * **Absence is the anonymous reader, not an unconstrained one.** A code path
 * the middleware did not cover — a job, a test, a route registered before it —
 * reads unrestricted content and nothing else. The opposite default would turn
 * every gap in coverage into an open door.
 */
@Injectable()
export class ReaderStore {
    private readonly storage = new AsyncLocalStorage<Reader>();

    /** Run `fn` with `reader` in scope. */
    run<T>(reader: Reader, fn: () => T): T {
        return this.storage.run(reader, fn);
    }

    /** The current reader, or the anonymous one. */
    current(): Reader {
        return this.storage.getStore() ?? ANONYMOUS;
    }
}
