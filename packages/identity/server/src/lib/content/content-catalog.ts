import type { ContentTypeDescriptor } from './content.constants';

/**
 * The read-side port over the host's content catalogue: every content type a
 * workspace can be granted access to. `@ortha-cms/content-server` implements it
 * over its code-defined registry and binds it to {@link CONTENT_CATALOG};
 * identity (the foundational package) injects the **token**, never the content
 * package — so identity stays free of a dependency on `content-server` (which
 * depends back on identity for its route guards), keeping the graph acyclic.
 *
 * Inject it with `@Optional()` and fall back to the built-in mock so identity
 * still boots and serves the workspace flow when no content plugin is present.
 */
export interface ContentCatalog {
    /** Every content type a workspace can be granted access to. */
    list(): readonly ContentTypeDescriptor[];
}

/** DI token the content plugin binds to the concrete {@link ContentCatalog}. */
export const CONTENT_CATALOG = Symbol('CONTENT_CATALOG');
