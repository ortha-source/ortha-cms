/**
 * The **read scope port** — the seam a downstream plugin uses to narrow what
 * the public content API returns, without this package knowing why.
 *
 * Content-server declares the port and consults it optionally from
 * `PublicEntriesQuery` and `PublicExpansionQuery`; an implementing plugin
 * (`@orthacms/segments-server`, for reader entitlements) binds a provider in
 * its own module. Every fragment returned is AND-ed onto the visibility
 * predicate the public read already states, so a scope can only ever *subtract*
 * rows — there is no shape of return value that widens a read.
 *
 * ## Why a second port rather than `CONTENT_ENTRY_EXTENSION`
 *
 * That port is documented as a **single binding**: one provider per app, and
 * i18n already holds it. Its own note suggests binding a composite when a
 * second extension appears, and for a write-pipeline extension that composes
 * cleanly — but "narrow a read" and "extend a write" are different
 * responsibilities with different failure modes. A composite would fuse i18n
 * and entitlements into one provider, where a fault in either silently drops
 * the other's clause. This port is therefore **multi-provider**: every bound
 * implementation contributes independently, order does not matter because the
 * fragments are AND-ed, and i18n's binding is left alone.
 *
 * ## Two constraints on an implementation
 *
 * **Synchronous.** The predicate is assembled inside the query builder, and
 * making that path async would ripple through every public read for the benefit
 * of one provider. A scope that needs I/O — resolving who the caller is, say —
 * must do it earlier in the request (a guard, an interceptor, middleware) and
 * read the result from its own request-scoped state here.
 *
 * **Public reads only.** These fragments are not applied to the admin's own
 * entries list. An admin caller is a member of the workspace looking at their
 * own CMS; a reader entitlement is about who may *consume* published content,
 * and scoping the editor's list by it would hide from an author the very rows
 * they are responsible for. The same split content grants already make.
 */

import type { SQL } from 'drizzle-orm';
import type { AnyContentType } from '../types/content-type';

/** What a scope is told about the read it is narrowing. */
export interface ContentReadScopeContext {
    /** The content type being read. Its table is `type.table`. */
    readonly type: AnyContentType;
    /**
     * The workspace the request resolved to. Every emitted fragment MUST stay
     * inside it — a subquery that forgets the workspace turns one tenant's
     * scope into a cross-tenant read.
     */
    readonly workspaceId: string;
}

/**
 * One contributed narrowing of the public read.
 *
 * Returning `undefined` means "nothing to add for this read", which is how an
 * implementation opts out per type, per workspace, or entirely — a plugin that
 * is installed but unconfigured must return `undefined` rather than a fragment
 * matching everything, so an unconfigured install pays nothing at all.
 */
export interface ContentReadScope {
    /** A predicate AND-ed onto the public visibility rule. */
    scope(context: ContentReadScopeContext): SQL | undefined;
}

/**
 * DI token implementations bind to, as a **multi** provider:
 *
 * ```ts
 * { provide: CONTENT_READ_SCOPE, useClass: SegmentReadScope, multi: true }
 * ```
 *
 * Consumers inject it `@Optional()`, so content-server boots with no scope
 * bound at all — which is the state every existing installation is in.
 */
export const CONTENT_READ_SCOPE = Symbol('CONTENT_READ_SCOPE');
