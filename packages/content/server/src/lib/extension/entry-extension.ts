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
import type { Database } from '@orthacms/database';
import type { ValidationIssue } from '@orthacms/content-domain';
import type { FieldSchema, ParsedRule } from '@orthacms/utils-server';
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

/**
 * Which write {@link ContentEntryExtension.afterUpdate} is running inside.
 *
 * The two are not symmetric, which is why the hook has to be told them apart.
 * On an **update** the edited row is the authority: what it now holds is what
 * the extension propagates outward. On a **create** it is the opposite — the
 * new row is the one with gaps to fill (a translation arrives carrying the
 * source's shared values but none of its links), so an extension that treated
 * it as the authority would push those gaps onto rows that were already right.
 */
export interface EntryWriteContext {
    /** True when the row was just INSERTed; false on an update. */
    created: boolean;
    /**
     * The caller has been told this save leaves other **published** rows the
     * extension rewrites failing validation, and confirmed it. Without it an
     * extension refuses such a save with a 422 carrying
     * {@link SIBLING_INVALIDATED_CODE}; with it the save goes through. Only the
     * admin's write routes set it, and only after showing the refusal to a
     * person — every other writer keeps the refusal.
     */
    allowInvalidSiblings?: boolean;
    /**
     * Present when the caller **asked first** (`askBeforeSiblingSync`): the
     * write is a dry run of its own fan-out. Every hook records each other
     * **live** row it rewrites here — what changes in it, field by field and
     * link by link — instead of refusing on its own, and once every hook has
     * run the pipeline refuses the whole write with a 422 carrying
     * {@link SIBLING_SYNC_UNCONFIRMED_CODE} and all of it, rolling it back. So
     * the person is asked **once**, about everything, by the code that would
     * have written it. Absent, nothing is recorded and nothing is asked.
     */
    fanout?: EntryFanoutRecorder;
    /**
     * Rows of other records the caller declined to have filled in — the
     * {@link EntryFanoutChange.optional} changes a person unticked. Read by
     * {@link ContentEntryExtension.syncReferrers} only: a gap left open is a
     * state the sync allows, while every other change it reports keeps one
     * record's languages consistent and cannot be declined row by row.
     */
    skipReferrers?: ReadonlySet<string>;
}

/** One value another row takes on — a column, not a link. */
export interface EntryFanoutFieldChange {
    field: string;
    before: unknown;
    after: unknown;
}

/**
 * One relation field's links on another row, as ids — the pipeline titles
 * them before they reach the wire. A single relation reads as a one-element
 * swap (`removed` the old id, `added` the new one).
 */
export interface EntryFanoutLinkChange {
    field: string;
    added: string[];
    removed: string[];
    /**
     * The **source's** linked records that have no translation in this row's
     * locale, so the row is left without them (i18n's I-18). Ids of the
     * source's own rows — named so the person sees which record went missing.
     */
    unresolved: string[];
}

/** One other live row a write would change, and what changes in it. */
export interface EntryFanoutChange {
    type: AnyContentType;
    entryId: string;
    /** The row's locale slug, on a localized type. */
    locale: string | null;
    /** A translation of the record being written, rather than another record. */
    sibling: boolean;
    /** Published before the write — it becomes Modified. */
    published: boolean;
    /**
     * The caller may leave this one out (by its `entryId`, through
     * {@link EntryWriteContext.skipReferrers}) and the write still holds
     * together. Only a filled-in gap is optional.
     */
    optional: boolean;
    fields: EntryFanoutFieldChange[];
    links: EntryFanoutLinkChange[];
}

/** One published other row a write would leave failing validation. */
export interface EntryFanoutInvalidation {
    type: AnyContentType;
    entryId: string;
    locale: string | null;
    sibling: boolean;
    issues: ValidationIssue[];
}

/**
 * What an asked-first write would do to other rows, collected across every
 * hook that runs in it. See {@link EntryWriteContext.fanout}.
 */
export interface EntryFanoutRecorder {
    changes: EntryFanoutChange[];
    invalidated: EntryFanoutInvalidation[];
}

/**
 * The relation deltas a write applies from the **inverse** side, per field:
 * each names rows of `owner` whose own link set (`owner.fields[field]`) the
 * write changes. `byGroup` when the ids are translation groups
 * (`by: "localeGroup"`), resolved to the rows in `locale`.
 */
export interface InverseLinkEdit {
    owner: AnyContentType;
    field: string;
    ids: string[];
    byGroup: boolean;
    locale?: string;
}

/**
 * The `code` on a 422 an extension raises when a save would leave another
 * **published** row it rewrites (a locale sibling) failing validation.
 *
 * It is what tells that refusal apart from an ordinary validation 422: its
 * `issues` describe the *other* rows, not the one the caller sent, so a client
 * must not pin them on its own form. The body also carries
 * `siblings: [{ locale, issues }]`, naming each row it would invalidate, and the
 * client may retry with `allowInvalidSiblings` once a person has agreed.
 */
export const SIBLING_INVALIDATED_CODE = 'content.sibling_invalidated';

/**
 * The `code` on the 422 a write that **asked first** (`askBeforeSiblingSync`,
 * {@link EntryWriteContext.fanout}) is refused with, because it would also
 * rewrite other live rows. Raised by the entries pipeline once every
 * extension hook has run, so it describes the whole write.
 *
 * The body carries `changes` — each other live row, with what changes in it
 * (`fields: [{ field, label, before, after }]`, `links: [{ field, label,
 * added, removed, unresolved }]` as titled refs) and whether it may be left
 * out (`optional`) — plus `locales`, the slugs of the record's own
 * translations among them, and `siblings: [{ locale, type, entryId, issues }]`,
 * the **published** rows it would leave failing validation. Nothing was
 * written. The client retries without the flag once a person has agreed,
 * adding `allowInvalidSiblings` when `siblings` was not empty and
 * `skipReferrers` with the optional rows they unticked.
 */
export const SIBLING_SYNC_UNCONFIRMED_CODE = 'content.sibling_sync_unconfirmed';

/**
 * What a write of one entry would **also** rewrite, beyond the row addressed.
 *
 * The entries pipeline does not know that a save can travel: an extension's
 * {@link ContentEntryExtension.afterUpdate} may rewrite a whole set of related
 * rows (the i18n plugin propagates a type's *shared* fields onto every sibling
 * in the translation group), and the caller that asked for "change this one
 * entry" has no way to see it. Everywhere a person types the change that is
 * tolerable — they are looking at the record and its language switcher. It is
 * not tolerable where an **agent** composes the change and it applies with no
 * human in between ([ADR-0009](../../../../../../docs/adr/0009-copilot-applies-directly.md)),
 * which is what this exists for: the copilot's propose tools ask before they
 * draft, so the receipt names the blast radius instead of reading as a
 * single-entry edit.
 *
 * It describes; it does not decide. Propagating shared values IS the contract —
 * "shared" means shared — so refusing the write would take away the only way to
 * edit a shared field at all. The defect was that nobody was told.
 */
export interface EntryWriteFanout {
    /**
     * The names of the fields **in the submitted values** whose value travels
     * to the other rows — a subset of what was asked for, never the whole type.
     */
    fields: readonly string[];
    /**
     * The other rows, named the way a person would recognise them (locale
     * slugs, for the i18n extension). Never empty: an extension returns
     * `undefined` rather than an empty description.
     */
    locales: readonly string[];
}

/**
 * Rows of **another** content type an extension rewrote as a side-effect of a
 * create — what {@link ContentEntryExtension.syncReferrers} hands back, grouped
 * by type so the pipeline can version each row against its own schema.
 */
export interface EntryReferrerRewrite {
    type: AnyContentType;
    rows: Record<string, unknown>[];
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
     * Runs as the **first statement inside the create and update
     * transactions**, before the row itself is touched — the seam for taking a
     * deterministic, transaction-scoped lock over the wider set the extension
     * will write in {@link afterUpdate}.
     *
     * It exists because ordering the extension's own locks is not enough. By
     * the time {@link afterUpdate} runs, this transaction already holds a row
     * lock on the entry being saved (the pipeline's `UPDATE … RETURNING`), and
     * that lock was taken outside any ordering the extension controls. Two
     * concurrent saves on two members of the same extension-defined set (two
     * locales of one translation group) therefore each hold a row the other is
     * about to request — a textbook lock-order inversion that Postgres resolves
     * by aborting one with `deadlock detected` (SQLSTATE 40P01), surfacing as a
     * 500. A lock taken *here* precedes every row lock, so it imposes a total
     * order on the set and the inversion becomes unreachable.
     *
     * Optional: an extension that writes only the row it was handed needs
     * nothing. `params` carries the extension-owned scope of the write
     * ({@link EntryScopeParams}) — on an update the pipeline fills in the
     * **stored** row's values, not the request's, since that is the set the
     * write actually contends on.
     */
    beforeWrite?(
        tx: EntryTransaction,
        type: AnyContentType,
        params: EntryScopeParams,
        workspaceId: string
    ): Promise<void>;

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
     *
     * An implementation MAY amend `row` **in place** for columns it derives for
     * that row itself (the i18n sync resolves a mirrored relation into the new
     * row's own locale on create). The caller snapshots `row` *after* this
     * call, so an in-place amendment lands in the revision; writing only to the
     * database would leave the first version describing something the row never
     * held.
     */
    afterUpdate(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        values: Record<string, unknown>,
        workspaceId: string,
        context: EntryWriteContext
    ): Promise<Record<string, unknown>[] | void>;

    /**
     * Runs inside the **create** transaction, after {@link afterUpdate} — the
     * seam for bringing rows of **other** content types up to date with the new
     * row's arrival. {@link afterUpdate} only ever reaches rows of the type
     * being saved; this is its counterpart for the rows that *refer to* it.
     *
     * The i18n extension uses it for the half of the relation sync that runs
     * from the target's side: a mirrored link into a record with no
     * translation in some locale is left unset there, and the translation
     * appearing later is a create of the **target** type — so without this
     * the gap stayed until someone happened to re-save the record linking it.
     *
     * Returns the rewritten rows grouped by their type; the pipeline appends a
     * revision for each, exactly as for {@link afterUpdate}'s rows. Optional:
     * an extension with nothing to say about other types omits it.
     */
    syncReferrers?(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        workspaceId: string,
        context: EntryWriteContext
    ): Promise<EntryReferrerRewrite[]>;

    /**
     * Runs inside the create and update transactions **before the row is
     * written or any relation delta applied**, when the write carries deltas
     * on an inverse relation — the {@link beforeWrite} of the *owner* rows
     * those deltas reach.
     *
     * An inverse delta writes the owner's join rows, so it takes the owner's
     * per-list append lock; a concurrent save of the owner takes its own
     * locks (i18n's translation-group lock) and then that same append lock.
     * Taking the owner's locks here, ahead of the deltas, is what keeps the
     * two from inverting — {@link syncInverseOwners} then runs under them.
     */
    lockInverseOwners?(
        tx: EntryTransaction,
        edits: InverseLinkEdit[],
        workspaceId: string
    ): Promise<void>;

    /**
     * Runs inside the create and update transactions after the relation
     * deltas, when the write carried deltas on an inverse relation: the owner
     * rows whose link sets just changed may have rows of their own to keep
     * consistent (i18n's locale siblings of a synced relation). Without it an
     * edit made from the far side changed one language of the owner and left
     * the rest behind. Returns the rows rewritten, grouped by type.
     */
    syncInverseOwners?(
        tx: EntryTransaction,
        edits: InverseLinkEdit[],
        workspaceId: string,
        context: EntryWriteContext
    ): Promise<EntryReferrerRewrite[]>;

    /**
     * What a write of `values` onto `entryId` would rewrite **besides that
     * row** — the read-only counterpart of {@link afterUpdate}, answered before
     * anything is written.
     *
     * The pipeline itself never calls it: a save just saves, and the fan-out is
     * the extension's own contract. It is asked by callers that have to
     * *describe* a change before making it — the copilot's `content_propose_*`
     * tools, whose receipt is the only place a user learns their content moved.
     *
     * Return `undefined` — not an empty description — when the write touches
     * nothing else: the type is not the extension's, no field in `values`
     * travels, or the row has no companions. Callers treat `undefined` as "an
     * ordinary single-row edit" and say nothing, which is the common case and
     * must stay silent.
     *
     * Reads only, and takes **no locks**: it runs outside the write
     * transaction and its answer is advisory by construction — a sibling can
     * appear between the description and the write. Locking here would put a
     * `FOR UPDATE` on a translation group for the duration of a model's turn.
     *
     * Optional: an extension that only ever writes the row it was handed has
     * nothing to describe.
     */
    describeFanout?(
        type: AnyContentType,
        entryId: string,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<EntryWriteFanout | undefined>;
}
