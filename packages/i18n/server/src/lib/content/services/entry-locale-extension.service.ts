import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common';
import {
    aliasedTable,
    and,
    eq,
    exists,
    inArray,
    isNull,
    ne,
    notExists,
    or,
    sql,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, UnitOfWork, type Database } from '@orthacms/database';
import {
    EntryValidationService,
    InjectContentRegistry,
    RelationLinkService,
    RELATION_LOCALE_SYNC,
    isJoinBackedRelation,
    relationLocaleSync,
    toColumns,
    toRecord,
    type AnyContentType,
    type ContentEntryExtension,
    type ContentTypeRegistry,
    type EntryFilterContext,
    type EntryFilterExtension,
    type EntryReferrerRewrite,
    type EntryScopeParams,
    type EntryTransaction,
    type EntryWriteContext,
    type EntryWriteFanout,
    type ValidationIssue
} from '@orthacms/content-server';
import {
    FilterOperator,
    ScalarFieldType,
    type FieldSchema,
    type ParsedRule
} from '@orthacms/utils-server';
import {
    CONTENT_FIELD_TYPE,
    ENTRY_STATUS,
    SIBLING_INVALIDATED_CODE,
    SIBLING_SYNC_UNCONFIRMED_CODE
} from '@orthacms/content-server';
import { LOCALE_FALLBACK_DEFAULT } from '../../i18n.constants';
import { LocaleRegistryService } from '../../locales/services/locale-registry.service';
import { lockLocaleGroup } from '../locale-group-lock';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * What the sibling sync knows about one join-backed relation field: the
 * source's links, in order, and per locale the equivalent each one resolves to
 * there — `null` where the target has no live translation in that locale.
 */
interface LinkPlan {
    target: AnyContentType;
    sourceIds: string[];
    byLocale: Map<string, (string | null)[]>;
}

/** Virtual filter field: the group holds a row in this locale. */
const HAS_LOCALE = 'hasLocale';
/** Virtual filter field: the group is missing a row in this locale. */
const MISSING_LOCALE = 'missingLocale';
/** Virtual filter field: how many locale rows the group holds. */
const LOCALE_COUNT = 'localeCount';

/**
 * Operators each virtual field admits (anything else is a 400).
 *
 * **`hasLocale` takes `eq` / `in` only, deliberately.** `ne` and `nin` were
 * permitted and read as the negation of "has this locale" — they are not. They
 * quantify *inside* the EXISTS, so `hasLocale ne "de"` renders
 * `EXISTS(sibling WHERE locale <> 'de')`: "the group holds some locale other
 * than German", which a fully-translated record satisfies. Asked for "records
 * without a German translation" it returned the German ones. `missingLocale` is
 * the field that expresses absence, so the negations are refused here rather
 * than silently answering a different question — a 400 naming the field is a
 * failure the caller can see and correct, a wrong row set is not.
 */
const LOCALE_FIELD_OPS: Record<string, ReadonlySet<string>> = {
    [HAS_LOCALE]: new Set<string>([FilterOperator.Eq, FilterOperator.In]),
    [MISSING_LOCALE]: new Set<string>([FilterOperator.Eq, FilterOperator.In]),
    [LOCALE_COUNT]: new Set<string>([
        FilterOperator.Eq,
        FilterOperator.Ne,
        FilterOperator.Gt,
        FilterOperator.Gte,
        FilterOperator.Lt,
        FilterOperator.Lte
    ])
};

/**
 * The i18n plugin's binding of content-server's `CONTENT_ENTRY_EXTENSION`
 * port — where every locale *behavior* lives, so the content library itself
 * stays locale-agnostic:
 *
 * - **List scoping** — the active-locale filter (strict; the default locale
 *   when the request names none), plus the relation picker's
 *   `localeFallback=default` union.
 * - **Create stamping** — validates the requested slug and stamps the
 *   `locale` envelope column (the group id comes from the column default: a
 *   plain create starts its own translation group).
 * - **Shared-field sync** — on update, non-`localized` field values propagate
 *   to every sibling row of the translation group, inside the same
 *   transaction; published siblings are re-validated so a draft edit can
 *   never silently invalidate live content. The rewritten siblings are handed
 *   back to the entries pipeline, which appends a **revision** for each — their
 *   values changed, so their history has to say so.
 * - **Virtual filters** — `hasLocale` / `missingLocale` / `localeCount`,
 *   resolved to EXISTS / count subqueries over the group (ridden by the
 *   `(locale_group_id, locale)` unique index).
 *
 * Every method no-ops for non-i18n types, as the port contract requires.
 */
@Injectable()
export class EntryLocaleExtensionService implements ContentEntryExtension {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly locales: LocaleRegistryService,
        private readonly validation: EntryValidationService,
        // Relation storage is content's, not ours: reading a link set and
        // replacing one are the same operations the entries pipeline performs,
        // and a second implementation here is how the join table's ordering
        // and de-duplication rules would drift.
        private readonly relations: RelationLinkService,
        private readonly uow: UnitOfWork,
        // Read by `syncReferrers` only: which other types hold a mirrored
        // relation into the one being created.
        @InjectContentRegistry() private readonly registry: ContentTypeRegistry
    ) {}

    /** @inheritdoc */
    listScope(
        type: AnyContentType,
        workspaceId: string,
        params: EntryScopeParams
    ): SQL | undefined {
        if (!type.i18n) return undefined;
        const requested = this.locales.resolve(params.locale);
        const table = type.table as unknown as ContentTable;
        const strict = eq(table['locale'], requested.slug);

        const fallback = this.locales.default();
        if (
            params.localeFallback !== LOCALE_FALLBACK_DEFAULT ||
            requested.slug === fallback.slug
        ) {
            // Strict mode (the records table): untranslated groups are hidden.
            return strict;
        }
        // Fallback mode (the relation picker): one row per group — the
        // requested locale where it exists, else the default-locale row.
        const sibling = aliasedTable(type.table, 'locale_sibling');
        const s = sibling as unknown as ContentTable;
        const requestedSibling = this.db
            .select({ one: sql`1` })
            .from(sibling)
            .where(
                and(
                    eq(s['localeGroupId'], table['localeGroupId']),
                    // The row's OWN workspace, not the caller's: a list that
                    // includes shared-workspace rows (ADR-0019) must find each
                    // group's sibling where the group lives. For an own row the
                    // two are the same value.
                    eq(s['workspaceId'], table['workspaceId']),
                    eq(s['locale'], requested.slug),
                    ...(type.paranoid ? [isNull(s['deletedAt'])] : [])
                )
            );
        return or(
            strict,
            and(eq(table['locale'], fallback.slug), notExists(requestedSibling))
        );
    }

    /**
     * @inheritdoc
     *
     * Stamps the validated `locale` (defaulting when absent). When a
     * `localeGroupId` is given the new row **joins that existing group** (a
     * sibling translation) — verified to name a real group in the workspace
     * first (else 404), so a typo can't spawn a stray one-row group. Absent →
     * the column default (`gen_random_uuid()`) starts a fresh group.
     */
    async createColumns(
        type: AnyContentType,
        workspaceId: string,
        params: EntryScopeParams
    ): Promise<Record<string, unknown>> {
        if (!type.i18n) return {};
        const columns: Record<string, unknown> = {
            locale: this.locales.resolve(params.locale).slug
        };
        if (params.localeGroupId !== undefined) {
            await this.assertGroupExists(
                type,
                params.localeGroupId,
                workspaceId
            );
            columns['localeGroupId'] = params.localeGroupId;
        }
        return columns;
    }

    /**
     * Assert a translation group has ≥1 live row in this workspace, so a
     * sibling attaches to a real group. Runs before the create's own
     * transaction — the (benign) TOCTOU window is covered by the row staying
     * valid and the `(locale_group_id, locale)` unique index still guarding
     * duplicates — but *inside* any enclosing unit of work, which is why it
     * reads through {@link UnitOfWork.current} rather than the base pool.
     */
    private async assertGroupExists(
        type: AnyContentType,
        localeGroupId: string,
        workspaceId: string
    ): Promise<void> {
        const table = type.table as unknown as ContentTable;
        // `uow.current()`, not `this.db` — the same distinction
        // `EntryWriterService` draws for its relation-target probe. Outside a
        // unit of work the two are one connection and an ordinary save is
        // unaffected. Inside one they are not, and the difference decides
        // whether a *group* can be built in a single transaction: a content
        // import writes the `en` row and then its `de` sibling in one unit of
        // work, and a probe on the base pool cannot see the uncommitted `en`
        // row — so the sibling was refused with "no translation group" for a
        // group created moments earlier in the same transaction, and an
        // imported locale pair arrived as one row plus an error.
        const [row] = await this.uow
            .current()
            .select({ one: sql`1` })
            .from(type.table)
            .where(
                and(
                    eq(table['localeGroupId'], localeGroupId),
                    eq(table['workspaceId'], workspaceId),
                    ...(type.paranoid ? [isNull(table['deletedAt'])] : [])
                )
            )
            .limit(1);
        if (!row) {
            throw new NotFoundException(
                `No translation group "${localeGroupId}" on "${type.name}".`
            );
        }
    }

    /**
     * @inheritdoc
     *
     * Takes the translation group's advisory lock, ahead of every row lock the
     * write will acquire. See {@link lockLocaleGroup} for why ordering the
     * sibling `FOR UPDATE` cannot replace this: the edited row is already
     * locked by the pipeline's own `UPDATE` before any i18n code runs, so two
     * saves in one group invert their lock order no matter how the sync sorts
     * its siblings.
     *
     * No group id means a create starting a fresh group — nothing to contend
     * on, so nothing to lock.
     */
    async beforeWrite(
        tx: EntryTransaction,
        type: AnyContentType,
        params: EntryScopeParams
    ): Promise<void> {
        if (!type.i18n || !params.localeGroupId) return;
        await lockLocaleGroup(tx, params.localeGroupId);
    }

    /** @inheritdoc */
    async afterUpdate(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        values: Record<string, unknown>,
        workspaceId: string,
        context: EntryWriteContext
    ): Promise<Record<string, unknown>[]> {
        if (!type.i18n) return [];

        // A newly-created sibling arrives carrying the source's shared *values*
        // (the client copies them) but none of its **relations** — those never
        // travel in a create body. Propagating outward from it would therefore
        // push emptiness onto rows that were already right, wiping the group's
        // links. So a create pulls its relations in from the group instead, and
        // only its columns propagate outward (which the client has already made
        // a no-op in the common case, and which is what makes a deliberately
        // different shared value on a create win — long-standing behavior).
        if (context.created) {
            await this.inheritRelationsFromGroup(tx, type, row, workspaceId);
        }
        return this.propagateToSiblings(tx, type, row, values, workspaceId, {
            relations: !context.created,
            allowInvalidSiblings: context.allowInvalidSiblings === true,
            askBeforeSync:
                !context.created && context.askBeforeSiblingSync === true
        });
    }

    /**
     * @inheritdoc
     *
     * The half of the mirrored-relation sync that runs from the **target's**
     * side. A mirrored link into a record with no translation in some locale
     * is left unset there (I-18), and when that translation is created later
     * it is a create of *this* type — so {@link afterUpdate}, which only
     * reaches rows of the type being saved, never looks at the records
     * pointing in. Here every record whose mirrored link reaches this row's
     * translation group is given the new row in its sibling of the same
     * locale, as that record's next save would have done.
     *
     * Only gaps are filled. A single FK that already holds a value is left as
     * it is; a link set is rebuilt from the record's donor sibling through
     * {@link siblingLinks}, which keeps whatever the sibling already rightly
     * links.
     */
    async syncReferrers(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        workspaceId: string
    ): Promise<EntryReferrerRewrite[]> {
        if (!type.i18n) return [];
        // Schema first, which is free: a localized type nothing mirrors into
        // — most of them — reads nothing at all.
        const referrers = this.mirroredReferrersOf(type);
        if (!referrers.length) return [];

        const table = type.table as unknown as ContentTable;
        // The new row's translations: the rows a record could already be
        // linking. Trashed ones included — a link to a translation in the bin
        // still names the record (I-33).
        const translations = (await tx
            .select({ id: sql<string>`${table['id']}` })
            .from(type.table)
            .where(
                and(
                    eq(table['localeGroupId'], row['localeGroupId'] as string),
                    ne(table['id'], row['id'] as string),
                    eq(table['workspaceId'], workspaceId)
                )
            )) as { id: string }[];
        if (!translations.length) return []; // a fresh group: nothing links it

        const rewrites: EntryReferrerRewrite[] = [];
        for (const { owner, fields } of referrers) {
            const rows = await this.backfillReferrer(
                tx,
                owner,
                fields,
                translations.map((translation) => translation.id),
                row,
                workspaceId
            );
            if (rows.length) rewrites.push({ type: owner, rows });
        }
        return rewrites;
    }

    /** @inheritdoc */
    async describeFanout(
        type: AnyContentType,
        entryId: string,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<EntryWriteFanout | undefined> {
        if (!type.i18n) return undefined;

        // Cheapest question first, and the one that decides the rest: a save
        // touching only per-locale fields is exactly what a translation is, and
        // it must not read the database — the copilot calls this on every
        // proposed edit, including the many that concern one language only.
        const fields = Object.keys(values).filter((name) =>
            this.travelsToSiblings(type, name)
        );
        if (!fields.length) return undefined;

        const table = type.table as unknown as ContentTable;
        const sibling = aliasedTable(type.table, 'fanout_sibling');
        const siblingColumns = sibling as unknown as ContentTable;
        // One self-join rather than "read the group id, then read the group":
        // the bulk tool describes up to BULK_MAX_SAVE_ITEMS items in a turn, so
        // halving the round trips per item is worth the denser query.
        //
        // No lock and no `deletedAt` filter, both on purpose. The lock is
        // covered in the port's JSDoc; the trashed rows are here because
        // `propagateToSiblings` rewrites them too (so a restore comes back
        // consistent with its group), and a description that quietly omitted
        // them would understate the change it exists to disclose.
        const rows = (await this.db
            .select({ locale: sql<string>`${siblingColumns['locale']}` })
            .from(type.table)
            .innerJoin(
                sibling,
                and(
                    eq(siblingColumns['localeGroupId'], table['localeGroupId']),
                    ne(siblingColumns['id'], table['id']),
                    eq(siblingColumns['workspaceId'], workspaceId)
                )
            )
            .where(
                and(
                    eq(table['id'], entryId),
                    eq(table['workspaceId'], workspaceId)
                )
            )) as { locale: string }[];

        const locales = [...new Set(rows.map((row) => row.locale))].sort();
        // An entry alone in its group is an ordinary single-row edit. Saying so
        // would put a caveat on the majority of edits and teach the reader to
        // skim past it on the one that matters.
        if (!locales.length) return undefined;
        return { fields, locales };
    }

    /**
     * Whether this field's value reaches the row's siblings when it is saved —
     * the predicate behind {@link describeFanout}, stated once against the same
     * three rules {@link propagateToSiblings} applies.
     *
     * It is broader than {@link sharedColumns}, deliberately: that method
     * answers "which columns copy across verbatim", because shared columns,
     * mirrored FKs and join-backed link sets are *applied* by three different
     * mechanisms. To a person being told what their change will do, the three
     * are one fact — the value they set here lands over there.
     *
     * A **mirrored** relation counts even though each sibling ends up holding a
     * different id: the sibling's link is being repointed at the record this
     * save chose, which is a change to that row whatever id expresses it.
     */
    private travelsToSiblings(type: AnyContentType, name: string): boolean {
        const spec = type.fields[name];
        if (!spec) return false;
        // Checked ahead of the relation rules for the same reason
        // `sharedColumns` checks it first: `localized` is the author's explicit
        // "this varies per language", and a field carrying it never propagates
        // however its relation options happen to read.
        if (spec.localized) return false;
        if (spec.type === CONTENT_FIELD_TYPE.Relation) {
            return relationLocaleSync(type, spec) !== RELATION_LOCALE_SYNC.None;
        }
        return true;
    }

    /**
     * Push this row's state onto every sibling in its translation group, and
     * return the rows actually rewritten (the pipeline appends a revision for
     * each — their content moved in this transaction, and without a version
     * their history would skip the change and a later restore would silently
     * undo it).
     *
     * Three kinds of state travel, each computed once and applied per sibling:
     * shared **columns** (identical everywhere), **mirrored** single-relation
     * FKs (resolved into each sibling's own locale), and the **link sets** of
     * join-backed relations. A sibling whose every one of those already matches
     * is left completely untouched — that guard is what stops one save
     * re-versioning the whole group.
     */
    private async propagateToSiblings(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        values: Record<string, unknown>,
        workspaceId: string,
        options: {
            relations: boolean;
            allowInvalidSiblings?: boolean;
            askBeforeSync?: boolean;
        }
    ): Promise<Record<string, unknown>[]> {
        const table = type.table as unknown as ContentTable;
        // Only the columns this save actually carries. A field the caller
        // omitted is `undefined`, which `.set()` skips — so it must be left out
        // of the change predicate too, or it would compare against a missing
        // bind parameter.
        const shared = Object.entries(this.sharedColumns(type, values) ?? {})
            .filter(([, value]) => value !== undefined)
            .map(([column, value]) => [column, value] as const);
        // Decide whether anything CAN travel before reading — and, more to the
        // point, before locking — anything. Both inputs are free: the columns
        // come from the save's own values bag, and whether a relation
        // propagates is a property of the schema.
        //
        // Skipping the query is not just an optimization. The read below takes
        // `FOR UPDATE` on every sibling of the group, so running it
        // unconditionally would make each save of a localized type lock rows it
        // has no intention of writing — on a type with no shared field and no
        // syncing relation, permanently and for nothing. The pre-relation code
        // had this property (it returned before touching the database when
        // there were no shared columns); restoring it keeps the lock footprint
        // proportional to what the save actually propagates.
        const canSyncRelations =
            options.relations &&
            Object.values(type.fields).some(
                (spec) =>
                    relationLocaleSync(type, spec) !== RELATION_LOCALE_SYNC.None
            );
        if (!shared.length && !canSyncRelations) return [];

        // Every sibling, locked. We need each row's own `locale` (to resolve a
        // mirrored link into it), and its **pre-write** publish status — the
        // re-validation below has to read the status from before the demotion,
        // since the UPDATE sets every touched row to `draft`. Soft-deleted
        // siblings are included, so a later restore comes back consistent with
        // the group. The lock also serializes two concurrent saves in different
        // locales of the same record, which would otherwise interleave.
        //
        // Ordered by id so the rows are locked in one canonical sequence. That
        // is a determinism guard, **not** the deadlock fix: the entry the
        // caller edited was already locked by the pipeline's own `UPDATE`
        // before this hook ran, so ordering the siblings alone still leaves two
        // savers each holding the row the other wants. `beforeWrite`'s group
        // advisory lock is what makes the inversion unreachable — see
        // {@link lockLocaleGroup}.
        const siblings = (await tx
            .select()
            .from(type.table)
            .where(
                and(
                    eq(table['localeGroupId'], row['localeGroupId'] as string),
                    ne(table['id'], row['id'] as string),
                    eq(table['workspaceId'], workspaceId)
                )
            )
            .orderBy(sql`${table['id']}`)
            .for('update')) as Record<string, unknown>[];
        if (!siblings.length) return [];

        const locales = [
            ...new Set(siblings.map((sibling) => sibling['locale'] as string))
        ];
        const mirrored = options.relations
            ? await this.mirroredColumnsByLocale(
                  tx,
                  type,
                  values,
                  locales,
                  workspaceId
              )
            : new Map<string, Record<string, unknown>>();
        const links = options.relations
            ? await this.linkSetsByLocale(
                  tx,
                  type,
                  row['id'] as string,
                  locales,
                  workspaceId
              )
            : new Map<string, LinkPlan>();

        const keep = options.relations
            ? await this.mirroredLinksToKeep(
                  tx,
                  type,
                  values,
                  siblings,
                  mirrored,
                  workspaceId
              )
            : new Map<string, Set<string>>();

        const rewritten: Record<string, unknown>[] = [];
        // The live siblings this save reaches, for the ask-first refusal
        // below. A trashed one is rewritten too (so a restore comes back
        // consistent) but is not named: the person cannot see it, and a
        // confirmation about rows nobody can find teaches people to skip it.
        const reachedLocales: string[] = [];
        const invalidated: {
            locale: string;
            issues: ValidationIssue[];
        }[] = [];
        for (const sibling of siblings) {
            const siblingId = sibling['id'] as string;
            const locale = sibling['locale'] as string;

            // Links first, so a links-only change still reaches the row write
            // below — that is what stamps `updatedAt`, demotes a published
            // sibling, and earns the row its revision.
            let linksMoved = false;
            for (const [field, plan] of links) {
                const moved = await this.relations.replaceLinks(
                    tx,
                    type,
                    siblingId,
                    field,
                    await this.siblingLinks(
                        tx,
                        type,
                        siblingId,
                        field,
                        plan,
                        locale,
                        workspaceId
                    )
                );
                linksMoved ||= moved;
            }

            const kept = keep.get(siblingId);
            const columns = [
                ...shared,
                ...Object.entries(mirrored.get(locale) ?? {}).filter(
                    ([column]) => !kept?.has(column)
                )
            ];
            // Nothing to write and nothing moved — leave the row (and its
            // history) completely alone. Guarding here matters: an empty
            // `differs` collapses to `undefined`, which would widen the UPDATE
            // to every sibling unconditionally.
            if (!columns.length && !linksMoved) continue;

            // Only rewrite a sibling whose columns actually differ. The save's
            // values bag carries every field the caller sent, so an
            // unconditional UPDATE re-versioned every sibling on every save,
            // even one that only changed a localized field. `IS DISTINCT FROM`
            // rather than `<>` so a NULL on either side compares correctly.
            //
            // Each value is bound with **its column's own encoder**
            // (`sql.param`), the same mapping `.set()` applies. Interpolating it
            // bare made an array-valued field (a `jsonb` multiselect, json, or a
            // multiple media field) expand into a parameter *list* —
            // `IS DISTINCT FROM ($1, $2, $3)` — which Postgres reads as a record
            // and rejects with `operator does not exist: jsonb = record`,
            // failing every save of an i18n type that carried one.
            const differs = or(
                ...columns.map(
                    ([column, value]) =>
                        sql`${table[column]} IS DISTINCT FROM ${sql.param(value, table[column])}`
                )
            );
            // When the links moved the row has already changed, so it is
            // written regardless of whether any column did.
            const where = linksMoved
                ? eq(table['id'], siblingId)
                : and(eq(table['id'], siblingId), differs);

            // A **published** sibling moves back to `draft`, exactly as the
            // entry the user edited does. Its content just changed, so its
            // published *version* is no longer what the row holds — leaving it
            // `published` made the same edit live in the untouched locales
            // while still pending in the edited one, and left its
            // freshly-appended draft version describing a row that claimed to
            // be live. `published_at` is kept, so the sibling reads as
            // **Modified** (live content, unpublished changes) rather than as a
            // never-published draft. Publishing any locale is still per-row;
            // this only stops one going live on another's save.
            const [updated] = (await tx
                .update(type.table)
                .set({
                    ...Object.fromEntries(columns),
                    ...(type.publishable ? { status: ENTRY_STATUS.Draft } : {}),
                    updatedAt: new Date()
                } as never)
                .where(where)
                .returning()) as Record<string, unknown>[];
            if (!updated) continue; // nothing differed after all
            if (sibling['deletedAt'] == null) reachedLocales.push(locale);

            // A sibling that **was** published must stay valid once the synced
            // state lands — re-validate it, and abort the whole save unless the
            // caller has already been told and confirmed (below). Drafts may be
            // temporarily invalid (the same rule as saving a draft directly).
            // This reads the pre-write status captured in the locked SELECT,
            // not the row's current one: the UPDATE has just demoted it to
            // `draft`, so testing the returned status would silently skip every
            // sibling.
            if (
                type.publishable &&
                sibling['status'] === ENTRY_STATUS.Published
            ) {
                const result = this.validation.validate(
                    type,
                    toRecord(type, updated).values,
                    // A required relation to a type this workspace isn't
                    // granted is not required here — the same waiver the
                    // publish gate applies, or a sync could refuse what a
                    // publish of that sibling would accept.
                    await this.validation.waivedRequired(type, workspaceId, tx)
                );
                if (!result.valid) {
                    invalidated.push({ locale, issues: result.issues });
                }
            }
            rewritten.push(updated);
        }

        // Collected rather than thrown at the first one, so the refusal can name
        // every language the save would leave unpublishable — that list is what
        // the editor's confirmation shows. A confirmed save goes through: each
        // such sibling is already demoted to Modified above, so its live
        // version keeps being served and the gap is only in its working copy,
        // which the person was shown before agreeing to it.
        // Asked first: name everything the save would do — every live sibling
        // it changes, and the published ones it would leave invalid — and
        // write none of it. Throwing rolls the transaction back, so the
        // refusal is the dry run, computed by the very code that would have
        // written it. Checked before the invalidation refusal, which is the
        // narrower half of the same answer.
        if (options.askBeforeSync && reachedLocales.length) {
            throw new UnprocessableEntityException({
                message:
                    `Shared fields would also change the ` +
                    reachedLocales.map((locale) => `"${locale}"`).join(', ') +
                    ` translation${reachedLocales.length > 1 ? 's' : ''}`,
                code: SIBLING_SYNC_UNCONFIRMED_CODE,
                locales: reachedLocales,
                siblings: invalidated
            });
        }

        if (invalidated.length && !options.allowInvalidSiblings) {
            throw new UnprocessableEntityException({
                message:
                    `Shared fields would invalidate the published ` +
                    invalidated.map(({ locale }) => `"${locale}"`).join(', ') +
                    ` translation${invalidated.length > 1 ? 's' : ''}`,
                code: SIBLING_INVALIDATED_CODE,
                siblings: invalidated,
                // Kept for callers that read only `issues`. They describe the
                // siblings, not the row the caller sent — which is why the
                // `code` exists: an editor must not pin them on its own form.
                issues: invalidated.flatMap(({ issues }) => issues)
            });
        }
        return rewritten;
    }

    /**
     * Fill a **newly created** sibling's propagating relations from the group
     * it just joined — the half of the sync that runs inward.
     *
     * A translation is created through the ordinary create route with a
     * `localeGroupId`, and a create body carries no relation links at all: they
     * are join-backed (never in the values bag) or per-locale (deliberately
     * dropped by the client, since the source's id names another language's
     * row). So without this a translation is born with none of the record's
     * links, which is exactly the manual per-locale re-linking this sync
     * exists to remove.
     *
     * The donor is one existing sibling — any of them agree on a shared link,
     * and a mirrored one resolves through the same translation group whichever
     * is asked — picked deterministically (the default locale where the group
     * has it) so two creates never inherit from different rows.
     *
     * Columns it derives are also written back onto `row` **in place**: the
     * caller snapshots that object as the new entry's first revision *after*
     * this call, so a database-only write would leave version 1 describing
     * something the row never held.
     */
    private async inheritRelationsFromGroup(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        workspaceId: string
    ): Promise<void> {
        const table = type.table as unknown as ContentTable;
        const locale = row['locale'] as string;
        const donors = (await tx
            .select()
            .from(type.table)
            .where(
                and(
                    eq(table['localeGroupId'], row['localeGroupId'] as string),
                    ne(table['id'], row['id'] as string),
                    eq(table['workspaceId'], workspaceId),
                    ...(type.paranoid ? [isNull(table['deletedAt'])] : [])
                )
            )) as Record<string, unknown>[];
        const donor = this.pickDonor(donors);
        if (!donor) return; // a fresh group: nothing to inherit

        // Reuse the outward machinery with the roles swapped: the donor is the
        // source, and this new row is the only "sibling" being written to.
        const mirrored = await this.mirroredColumnsByLocale(
            tx,
            type,
            toRecord(type, donor).values,
            [locale],
            workspaceId
        );
        const links = await this.linkSetsByLocale(
            tx,
            type,
            donor['id'] as string,
            [locale],
            workspaceId
        );

        for (const [field, plan] of links) {
            // A new row holds no links of its own, so an untranslated target
            // has nothing to keep — it is simply not linked here.
            await this.relations.replaceLinks(
                tx,
                type,
                row['id'] as string,
                field,
                (plan.byLocale.get(locale) ?? []).filter(
                    (id): id is string => !!id
                )
            );
        }

        const columns = Object.entries(mirrored.get(locale) ?? {});
        if (!columns.length) return;
        const [updated] = (await tx
            .update(type.table)
            .set(Object.fromEntries(columns) as never)
            .where(eq(table['id'], row['id'] as string))
            .returning()) as Record<string, unknown>[];
        // Keep the caller's row object in step with what was just stored (see
        // the note above about the first revision).
        if (updated) Object.assign(row, updated);
    }

    /**
     * Every localized type holding a **mirrored** relation into `target`, with
     * the names of those fields — the records whose links resolve through
     * `target`'s translation groups.
     */
    private mirroredReferrersOf(
        target: AnyContentType
    ): { owner: AnyContentType; fields: string[] }[] {
        return this.registry.all().flatMap((owner) => {
            const fields = Object.entries(owner.fields)
                .filter(
                    ([, spec]) =>
                        relationLocaleSync(owner, spec) ===
                            RELATION_LOCALE_SYNC.Mirrored &&
                        spec.relation?.to().name === target.name
                )
                .map(([name]) => name);
            return fields.length ? [{ owner, fields }] : [];
        });
    }

    /**
     * {@link syncReferrers} for one referring type: fill the new row into the
     * `owner` records whose mirrored `fields` link one of `translationIds`,
     * in their sibling of the new row's locale. Returns the rows rewritten.
     *
     * Each such record's translation group is locked the way a save of it
     * would lock it ({@link lockLocaleGroup}, in sorted order), so this cannot
     * interleave with a concurrent save of the record — the rows are read
     * again under that lock, and only then compared and written.
     */
    private async backfillReferrer(
        tx: EntryTransaction,
        owner: AnyContentType,
        fields: string[],
        translationIds: string[],
        row: Record<string, unknown>,
        workspaceId: string
    ): Promise<Record<string, unknown>[]> {
        const table = owner.table as unknown as ContentTable;
        const locale = row['locale'] as string;

        // Per join-backed field, the records linking a translation. A single
        // FK needs no such set: the rows read below carry their own value.
        const linkers = new Map<string, Set<string>>();
        const linking = new Set<string>();
        for (const name of fields) {
            const ids = isJoinBackedRelation(owner.fields[name])
                ? await this.relations.sourceIdsLinking(
                      tx,
                      owner,
                      name,
                      translationIds
                  )
                : (
                      (await tx
                          .select({ id: sql<string>`${table['id']}` })
                          .from(owner.table)
                          .where(
                              and(
                                  inArray(table[name], translationIds),
                                  eq(table['workspaceId'], workspaceId)
                              )
                          )) as { id: string }[]
                  ).map((linker) => linker.id);
            linkers.set(name, new Set(ids));
            for (const id of ids) linking.add(id);
        }
        if (!linking.size) return [];

        const groups = (
            (await tx
                .selectDistinct({
                    group: sql<string>`${table['localeGroupId']}`
                })
                .from(owner.table)
                .where(
                    and(
                        inArray(table['id'], [...linking]),
                        eq(table['workspaceId'], workspaceId)
                    )
                )) as { group: string }[]
        )
            .map(({ group }) => group)
            .sort();
        for (const group of groups) await lockLocaleGroup(tx, group);

        const members = (await tx
            .select()
            .from(owner.table)
            .where(
                and(
                    inArray(table['localeGroupId'], groups),
                    eq(table['workspaceId'], workspaceId)
                )
            )
            .orderBy(sql`${table['id']}`)
            .for('update')) as Record<string, unknown>[];

        const rewritten: Record<string, unknown>[] = [];
        for (const group of groups) {
            const inGroup = members.filter(
                (member) => member['localeGroupId'] === group
            );
            // A trashed row is still filled in (so a restore comes back
            // consistent, as `propagateToSiblings` does) but never read from.
            const donors = inGroup.filter(
                (member) =>
                    member['locale'] !== locale &&
                    (!owner.paranoid || member['deletedAt'] == null)
            );
            for (const sibling of inGroup) {
                if (sibling['locale'] !== locale) continue;
                const siblingId = sibling['id'] as string;
                const columns: Record<string, unknown> = {};
                let linksMoved = false;
                for (const name of fields) {
                    if (!isJoinBackedRelation(owner.fields[name])) {
                        // The record links this target, so in this locale it
                        // links the new row — unless the sibling already
                        // holds a link of its own.
                        if (sibling[name] != null) continue;
                        if (
                            donors.some((donor) =>
                                translationIds.includes(donor[name] as string)
                            )
                        ) {
                            columns[name] = row['id'];
                        }
                        continue;
                    }
                    const donor = this.pickDonor(
                        donors.filter((candidate) =>
                            linkers.get(name)?.has(candidate['id'] as string)
                        )
                    );
                    if (!donor) continue;
                    const plan = await this.linkPlanOf(
                        tx,
                        owner,
                        name,
                        donor['id'] as string,
                        [locale],
                        workspaceId
                    );
                    const moved = await this.relations.replaceLinks(
                        tx,
                        owner,
                        siblingId,
                        name,
                        await this.siblingLinks(
                            tx,
                            owner,
                            siblingId,
                            name,
                            plan,
                            locale,
                            workspaceId
                        )
                    );
                    linksMoved ||= moved;
                }
                if (!Object.keys(columns).length && !linksMoved) continue;

                // Written like any synced sibling: a published one moves to
                // draft (Modified), since its live version does not hold the
                // link it now has.
                const [updated] = (await tx
                    .update(owner.table)
                    .set({
                        ...columns,
                        ...(owner.publishable
                            ? { status: ENTRY_STATUS.Draft }
                            : {}),
                        updatedAt: new Date()
                    } as never)
                    .where(eq(table['id'], siblingId))
                    .returning()) as Record<string, unknown>[];
                if (updated) rewritten.push(updated);
            }
        }
        return rewritten;
    }

    /**
     * The sibling a group's synced state is read from when a row is filled in
     * rather than propagated to — the default locale's row where there is
     * one, else the lexicographically first, so two writes never pick
     * different rows. `undefined` when there is none.
     */
    private pickDonor(
        rows: Record<string, unknown>[]
    ): Record<string, unknown> | undefined {
        const fallback = this.locales.default().slug;
        return (
            rows.find((candidate) => candidate['locale'] === fallback) ??
            [...rows].sort((a, b) =>
                (a['locale'] as string).localeCompare(b['locale'] as string)
            )[0]
        );
    }

    /**
     * Per locale, the **mirrored** single-relation FK columns a sibling in that
     * locale should hold: the source's linked record, resolved to that record's
     * own translation in the sibling's language.
     *
     * An unresolvable link becomes `null` rather than being skipped. Leaving
     * the sibling's existing value would keep it pointing at the *previous*
     * record's translation — silently wrong data, which is worse than an empty
     * field that the editor can see and the publish gate can block on.
     */
    private async mirroredColumnsByLocale(
        tx: EntryTransaction,
        type: AnyContentType,
        values: Record<string, unknown>,
        locales: string[],
        workspaceId: string
    ): Promise<Map<string, Record<string, unknown>>> {
        const out = new Map<string, Record<string, unknown>>();
        for (const locale of locales) out.set(locale, {});

        for (const [name, spec] of Object.entries(type.fields)) {
            if (
                relationLocaleSync(type, spec) !==
                    RELATION_LOCALE_SYNC.Mirrored ||
                isJoinBackedRelation(spec)
            ) {
                continue;
            }
            // A field this save didn't carry says nothing about what the
            // siblings should hold (a merge-patch names only what changed).
            if (!(name in values)) continue;
            const sourceId = values[name];
            if (typeof sourceId !== 'string' || !sourceId) {
                for (const locale of locales)
                    (out.get(locale) as Record<string, unknown>)[name] = null;
                continue;
            }
            const equivalents = await this.relations.equivalentIdsByLocale(
                tx,
                spec.relation?.to() as AnyContentType,
                [sourceId],
                locales,
                workspaceId
            );
            for (const locale of locales) {
                (out.get(locale) as Record<string, unknown>)[name] =
                    equivalents.get(locale)?.get(sourceId) ?? null;
            }
        }
        return out;
    }

    /**
     * Per join-backed relation field, the link set a sibling in each locale
     * should hold — as a {@link LinkPlan}, aligned with the source's own links.
     *
     * A **shared** relation hands every sibling the source's ids verbatim — the
     * target has no locales, so there is one right row for the whole group. A
     * **mirrored** one maps each id through its translation group into the
     * sibling's language, preserving the source's order. A link whose target
     * has no live translation there is `null` in the plan rather than dropped:
     * what a sibling makes of that gap depends on what it already links (see
     * {@link siblingLinks}), and it is never a reason to fail this save.
     */
    private async linkSetsByLocale(
        tx: EntryTransaction,
        type: AnyContentType,
        sourceId: string,
        locales: string[],
        workspaceId: string
    ): Promise<Map<string, LinkPlan>> {
        const out = new Map<string, LinkPlan>();
        for (const [name, spec] of Object.entries(type.fields)) {
            const mode = relationLocaleSync(type, spec);
            if (mode === RELATION_LOCALE_SYNC.None) continue;
            if (!isJoinBackedRelation(spec)) continue;

            out.set(
                name,
                await this.linkPlanOf(
                    tx,
                    type,
                    name,
                    sourceId,
                    locales,
                    workspaceId
                )
            );
        }
        return out;
    }

    /**
     * The {@link LinkPlan} of one join-backed, syncing relation field — the
     * per-field step of {@link linkSetsByLocale}, also used on its own by
     * {@link syncReferrers}, which has exactly one field to plan.
     */
    private async linkPlanOf(
        tx: EntryTransaction,
        type: AnyContentType,
        name: string,
        sourceId: string,
        locales: string[],
        workspaceId: string
    ): Promise<LinkPlan> {
        const spec = type.fields[name];
        const target = spec.relation?.to() as AnyContentType;
        const ids = await this.relations.linkIdsOf(tx, type, sourceId, name);
        const byLocale = new Map<string, (string | null)[]>();
        if (relationLocaleSync(type, spec) === RELATION_LOCALE_SYNC.Shared) {
            for (const locale of locales) byLocale.set(locale, ids);
        } else {
            const equivalents = await this.relations.equivalentIdsByLocale(
                tx,
                target,
                ids,
                locales,
                workspaceId
            );
            for (const locale of locales) {
                const map = equivalents.get(locale);
                byLocale.set(
                    locale,
                    ids.map((id) => map?.get(id) ?? null)
                );
            }
        }
        return { target, sourceIds: ids, byLocale };
    }

    /**
     * The link ids one sibling should end up holding for a join-backed field.
     *
     * Where every source link resolved into the sibling's locale this is just
     * the plan. Where one did not, the sibling's **own** link into the same
     * translation group is kept in that position — a translation of the very
     * record the source links, which is in the bin. Dropping it would unlink
     * the record in that language because of a gap on the *target*, and the
     * link would not come back when the translation is restored. A link into
     * some other group is still dropped: the source moved off that record.
     */
    private async siblingLinks(
        tx: EntryTransaction,
        type: AnyContentType,
        siblingId: string,
        field: string,
        plan: LinkPlan,
        locale: string,
        workspaceId: string
    ): Promise<string[]> {
        const aligned = plan.byLocale.get(locale) ?? [];
        if (!aligned.includes(null)) return aligned as string[];

        const current = await this.relations.linkIdsOf(
            tx,
            type,
            siblingId,
            field
        );
        const unresolved = plan.sourceIds.filter(
            (_, index) => aligned[index] === null
        );
        const groups = current.length
            ? await this.relations.localeGroupsOf(
                  tx,
                  plan.target,
                  [...unresolved, ...current],
                  workspaceId
              )
            : new Map<string, string>();

        const used = new Set(aligned.filter((id): id is string => !!id));
        const out: string[] = [];
        aligned.forEach((id, index) => {
            if (id) {
                out.push(id);
                return;
            }
            const group = groups.get(plan.sourceIds[index]);
            const kept = group
                ? current.find(
                      (candidate) =>
                          !used.has(candidate) &&
                          groups.get(candidate) === group
                  )
                : undefined;
            if (kept) {
                used.add(kept);
                out.push(kept);
            }
        });
        return out;
    }

    /**
     * Per sibling id, the **mirrored single-relation** columns the sync must
     * leave alone: the source's target has no live translation in that
     * sibling's locale, but the sibling already links a row of the same
     * translation group — a translation of the very record the source links,
     * sitting in the bin.
     *
     * {@link mirroredColumnsByLocale} reports such a column as `null`, which
     * is right for a sibling pointing at some *other* record (leaving it would
     * credit the previous author). For this one it is wrong twice over: the
     * link is still the right one and comes back to life when the translation
     * is restored, and nulling a **required** relation on a published sibling
     * made every later save of the record, in any language and touching any
     * field, a 422 until the translation was restored.
     */
    private async mirroredLinksToKeep(
        tx: EntryTransaction,
        type: AnyContentType,
        values: Record<string, unknown>,
        siblings: Record<string, unknown>[],
        mirrored: Map<string, Record<string, unknown>>,
        workspaceId: string
    ): Promise<Map<string, Set<string>>> {
        const keep = new Map<string, Set<string>>();
        for (const [name, spec] of Object.entries(type.fields)) {
            if (
                relationLocaleSync(type, spec) !==
                    RELATION_LOCALE_SYNC.Mirrored ||
                isJoinBackedRelation(spec)
            ) {
                continue;
            }
            const sourceId = values[name];
            // A cleared link is cleared everywhere — nothing to keep.
            if (typeof sourceId !== 'string' || !sourceId) continue;

            const candidates = siblings.filter((sibling) => {
                const resolved = mirrored.get(sibling['locale'] as string);
                const current = sibling[name];
                return (
                    resolved?.[name] === null &&
                    typeof current === 'string' &&
                    !!current
                );
            });
            if (!candidates.length) continue;

            const groups = await this.relations.localeGroupsOf(
                tx,
                spec.relation?.to() as AnyContentType,
                [sourceId, ...candidates.map((s) => s[name] as string)],
                workspaceId
            );
            const group = groups.get(sourceId);
            if (!group) continue;
            for (const sibling of candidates) {
                if (groups.get(sibling[name] as string) !== group) continue;
                const id = sibling['id'] as string;
                const fields = keep.get(id) ?? new Set<string>();
                fields.add(name);
                keep.set(id, fields);
            }
        }
        return keep;
    }

    /** @inheritdoc */
    filterExtension(type: AnyContentType): EntryFilterExtension | undefined {
        if (!type.i18n) return undefined;
        const slugs = this.locales.all().map((locale) => locale.slug);
        const fields: FieldSchema = {
            [HAS_LOCALE]: { type: ScalarFieldType.Enum, enumValues: slugs },
            [MISSING_LOCALE]: { type: ScalarFieldType.Enum, enumValues: slugs },
            [LOCALE_COUNT]: { type: ScalarFieldType.Number }
        };
        return {
            fields,
            resolve: (rule, context) => this.resolveLocaleRule(rule, context)
        };
    }

    /**
     * Translate one virtual locale rule into SQL. All three fields quantify
     * over the row's translation group via a self-EXISTS/count subquery,
     * workspace-scoped, (on paranoid types) live-rows-only, and **restricted to
     * the configured locale set** — the same restriction the coverage query
     * applies (`configuredScope`).
     *
     * That last one is what keeps the records table and the Translation
     * coverage card telling the same story. A row in a slug the host has since
     * dropped is not coverage of anything: coverage filters it out, so leaving
     * it in here made `localeCount` count higher than the number of configured
     * locales, and a record the card reported as fully localized answered
     * neither `localeCount eq 3` (the configured total) nor any `hasLocale`
     * question consistent with it. Two views of one record, disagreeing.
     *
     * `missingLocale in [a, b]` is a `notExists` over the union, so it means
     * "missing **all** of these", not "missing any" — the union has no matching
     * sibling only when every named locale is absent. It is the useful reading
     * for the records table ("show me what has none of my target languages");
     * "missing any" is expressed as an `or` of `missingLocale eq` rules.
     */
    private async resolveLocaleRule(
        rule: ParsedRule,
        context: EntryFilterContext
    ): Promise<SQL> {
        const field = rule.path[0];
        const allowedOps = LOCALE_FIELD_OPS[field];
        if (!allowedOps?.has(rule.op)) {
            throw new BadRequestException(
                `Operator "${rule.op}" is not supported on "${field}".`
            );
        }
        const { type, workspaceId } = context;
        const table = type.table as unknown as ContentTable;
        const sibling = aliasedTable(type.table, 'locale_sibling');
        const s = sibling as unknown as ContentTable;
        const groupScope = and(
            eq(s['localeGroupId'], table['localeGroupId']),
            eq(s['workspaceId'], workspaceId),
            // Only rows in a **configured** locale count as a translation —
            // mirrors the coverage query's `configuredScope`, so the two
            // cannot disagree about the same record.
            inArray(
                s['locale'],
                this.locales.all().map((locale) => locale.slug)
            ),
            ...(type.paranoid ? [isNull(s['deletedAt'])] : [])
        );

        if (field === LOCALE_COUNT) {
            const countSubquery = this.db
                .select({ n: sql`count(*)` })
                .from(sibling)
                .where(groupScope);
            const value = rule.value as number;
            switch (rule.op) {
                case FilterOperator.Eq:
                    return sql`(${countSubquery}) = ${value}`;
                case FilterOperator.Ne:
                    return sql`(${countSubquery}) <> ${value}`;
                case FilterOperator.Gt:
                    return sql`(${countSubquery}) > ${value}`;
                case FilterOperator.Gte:
                    return sql`(${countSubquery}) >= ${value}`;
                case FilterOperator.Lt:
                    return sql`(${countSubquery}) < ${value}`;
                default:
                    return sql`(${countSubquery}) <= ${value}`;
            }
        }

        // hasLocale / missingLocale: EXISTS (or its negation) of a sibling row
        // in the named locale(s). Only `eq` and `in` reach here — the negating
        // operators are refused above, because negating *inside* the EXISTS is
        // not the negation of the EXISTS (see LOCALE_FIELD_OPS).
        const localePredicate =
            rule.op === FilterOperator.In
                ? inArray(s['locale'], rule.value as string[])
                : eq(s['locale'], rule.value as string);
        const siblingInLocale = this.db
            .select({ one: sql`1` })
            .from(sibling)
            .where(and(groupScope, localePredicate));
        return field === HAS_LOCALE
            ? exists(siblingInLocale)
            : notExists(siblingInLocale);
    }

    /**
     * The column bag of the fields whose value is **identical in every locale**,
     * drawn from a save's coerced values — the part of the sync that is the
     * same for every sibling.
     *
     * Scalars and media qualify unless marked `localized`. A relation qualifies
     * only when it is column-backed *and* {@link RELATION_LOCALE_SYNC.Shared}:
     * a join-backed relation has no column to copy (its links go through
     * {@link linkSetsByLocale}), and a mirrored one stores a different id in
     * every locale by design (see {@link mirroredColumnsByLocale}), so copying
     * one verbatim would be exactly the cross-locale link the writer rejects.
     *
     * `null` when the type has no such field at all.
     */
    private sharedColumns(
        type: AnyContentType,
        values: Record<string, unknown>
    ): Record<string, unknown> | null {
        const sharedFields = Object.entries(type.fields).filter(([, spec]) => {
            if (spec.localized) return false;
            if (spec.type !== CONTENT_FIELD_TYPE.Relation) return true;
            if (spec.relation?.many || spec.relation?.inverse) return false;
            return (
                relationLocaleSync(type, spec) === RELATION_LOCALE_SYNC.Shared
            );
        });
        if (!sharedFields.length) return null;
        const allColumns = toColumns(type, values);
        const shared: Record<string, unknown> = {};
        for (const [name] of sharedFields) {
            shared[name] = allColumns[name];
        }
        return shared;
    }
}
