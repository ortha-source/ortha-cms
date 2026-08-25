import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import type { SegmentTag, SegmentTypeKey } from '@orthacms/segments-domain';

/** One reader, resolved. */
export interface CallerSegments {
    /** The raw tags the resolver produced — kept for explanation and logging. */
    readonly tags: ReadonlySet<SegmentTag>;
    /** Their segment ids, grouped by segment type key. */
    readonly byType: ReadonlyMap<SegmentTypeKey, readonly string[]>;
}

/** A reader carrying nothing: the anonymous case, and the failure case. */
export const ANONYMOUS_CALLER: CallerSegments = {
    tags: new Set(),
    byType: new Map()
};

/**
 * Who is reading, for the duration of one request.
 *
 * `CONTENT_READ_SCOPE` is synchronous by contract — the predicate is assembled
 * inside the query builder — so the caller's segments have to be resolved
 * before the query starts and be reachable without an injection point of their
 * own. An `AsyncLocalStorage` gives exactly that: the middleware resolves once,
 * runs the rest of the request inside the store, and every read below it sees
 * the same answer with no plumbing through content-server's signatures.
 *
 * A request-scoped Nest provider would be the other way to do this, and is
 * worse here: it forces every consumer up the chain into request scope,
 * including services content-server instantiates once.
 *
 * **Absence is anonymous, not unrestricted.** `current()` returning `undefined`
 * means the middleware did not run for this request — a route it does not
 * cover, or a read outside the request cycle — and the read scope treats that as
 * a reader with no segments. Unrestricted content is still served; restricted
 * content is not. The alternative, treating an unknown caller as unconstrained,
 * turns every gap in middleware coverage into an open door.
 */
@Injectable()
export class CallerSegmentsStore {
    private readonly storage = new AsyncLocalStorage<CallerSegments>();

    /** Run `fn` with `caller` visible to everything it awaits. */
    run<T>(caller: CallerSegments, fn: () => T): T {
        return this.storage.run(caller, fn);
    }

    /** The current reader, or `undefined` outside a resolved request. */
    current(): CallerSegments | undefined {
        return this.storage.getStore();
    }

    /** The current reader, falling back to the anonymous one. */
    currentOrAnonymous(): CallerSegments {
        return this.storage.getStore() ?? ANONYMOUS_CALLER;
    }
}
