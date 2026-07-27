/**
 * The entries **extension port** — the seam through which a downstream plugin
 * (e.g. a localization plugin) extends the generic entries pipeline without
 * this package knowing its domain. Content-server *declares* the port and
 * consults it optionally (`@Optional()` injection) from {@link EntriesService}
 * and {@link EntryWriterService}; the extending plugin *binds* an
 * implementation to {@link CONTENT_ENTRY_EXTENSION} in its own module — the
 * same inversion as identity's `CONTENT_CATALOG`, with the roles swapped.
 *
 * Every method is called unconditionally when an extension is bound, for every
 * content type — an implementation MUST no-op (return `undefined` / `{}`) for
 * types it doesn't apply to, so binding an extension never changes the
 * behavior of unrelated types.
 *
 * NestJS-free on purpose (types + a Symbol only): implementations live in
 * other packages, and keeping decorators out means this file could move into
 * a decorator-free subpath without churn.
 *
 * Currently a **single binding**: one provider per app. If a second extension
 * ever needs to coexist, bind a composite that fans out to both — the port's
 * shape (SQL fragments AND-ed, column bags merged) composes cleanly.
 */

import type { SQL } from 'drizzle-orm';
import type { Database } from '@ortha-cms/database';
import type { FieldSchema, ParsedRule } from '@ortha-cms/utils-server';
import type { AnyContentType } from '../types/content-type';

/** DI token an extension plugin binds its {@link ContentEntryExtension} to. */
export const CONTENT_ENTRY_EXTENSION = Symbol('CONTENT_ENTRY_EXTENSION');

/**
 * Extension-owned request parameters, forwarded verbatim from the wire
 * (`?locale=` / `?localeFallback=` on reads, `body.locale` on create).
 * Content-server declares them on its DTOs — the strict global
 * `ValidationPipe` rejects undeclared keys, so a generic bag isn't possible —
 * but never interprets them; their semantics live entirely behind the port.
 */
export interface EntryScopeParams {
    /** Locale slug the request targets; validated by the extension. */
    locale?: string;
    /**
     * `'default'` widens {@link ContentEntryExtension.listScope} to fall back
     * to the default locale where the requested one is missing (used by the
     * admin's relation picker); absent = strict.
     */
    localeFallback?: string;
    /**
     * On **create**, the existing translation group the new row joins (making
     * it a sibling). Absent → the row starts its own fresh group. Validated by
     * the extension against the workspace.
     */
    localeGroupId?: string;
}

/** Context handed to {@link EntryFilterExtension.resolve} with each rule. */
export interface EntryFilterContext {
    /** The content type the list request targets. */
    type: AnyContentType;
    /** The requesting workspace — every emitted subquery MUST scope to it. */
    workspaceId: string;
}

/**
 * Virtual filter fields an extension contributes to one type's `?filter=`
 * schema — e.g. "has locale", "locale count" — resolved to SQL subqueries by
 * the extension itself via the filter engine's `resolveExtension` hook.
 */
export interface EntryFilterExtension {
    /**
     * Parser declarations for the virtual fields, merged into the type's
     * `FilterSchema.fields` and registered as `extensionFields` (so the
     * translator routes them here instead of to a column).
     */
    fields: FieldSchema;
    /** Translate one virtual-field rule into a SQL predicate. */
    resolve(rule: ParsedRule, context: EntryFilterContext): Promise<SQL>;
}

/**
 * A transaction handle of the shared Drizzle client — what
 * {@link ContentEntryExtension.afterUpdate} receives so its writes commit or
 * roll back with the triggering update.
 */
export type EntryTransaction = Parameters<
    Parameters<Database['transaction']>[0]
>[0];

/**
 * The operations the entries pipeline consults an extension for. All methods
 * are required — a no-op is `undefined`/`{}`, keeping call sites branch-free.
 */
export interface ContentEntryExtension {
    /**
     * An extra predicate AND-ed into the list WHERE (alongside the workspace
     * scope, search, filter tree, and soft-delete guard). Interprets and
     * validates {@link EntryScopeParams} — throw a `BadRequestException` for
     * an invalid value. Return `undefined` to add nothing.
     */
    listScope(
        type: AnyContentType,
        workspaceId: string,
        params: EntryScopeParams
    ): SQL | undefined;

    /**
     * Virtual filter fields for the type's `?filter=` schema, or `undefined`
     * when the extension adds none for this type.
     */
    filterExtension(type: AnyContentType): EntryFilterExtension | undefined;

    /**
     * Extra envelope columns stamped onto the INSERT of a create (merged over
     * the field columns + `workspaceId`). Interprets/validates
     * {@link EntryScopeParams} — may throw (e.g. an unknown locale or a
     * `localeGroupId` that names no group in the workspace). Return `{}` to add
     * nothing. May be async (the group check reads the DB); the caller awaits.
     */
    createColumns(
        type: AnyContentType,
        workspaceId: string,
        params: EntryScopeParams
    ): Record<string, unknown> | Promise<Record<string, unknown>>;

    /**
     * Runs inside the **create and update** transactions, after the row's
     * columns and relation deltas are written — e.g. to propagate shared values
     * to sibling rows (so a newly-created sibling lands consistent with its
     * group, and an edit re-syncs). A throw rolls the whole save back. The
     * implementation must no-op when there are no siblings to affect.
     *
     * Returns the **other rows it changed**, if any. The entries pipeline
     * appends a revision for each, in the same transaction — so a row whose
     * values an extension rewrote gets the history entry it earned, instead of
     * its timeline silently skipping the change.
     *
     * Revision writing deliberately stays here rather than in the extension:
     * numbering is serialized per entry by an advisory lock, and a second
     * writer allocating numbers out-of-band is how duplicate versions happen.
     */
    afterUpdate(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<Record<string, unknown>[] | void>;
}
