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
    notInArray,
    or,
    sql,
    type AnyColumn,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import {
    EntryValidationService,
    isPerLocaleRelation,
    toColumns,
    toRecord,
    type AnyContentType,
    type ContentEntryExtension,
    type EntryFilterContext,
    type EntryFilterExtension,
    type EntryScopeParams,
    type EntryTransaction
} from '@ortha-cms/content-server';
import {
    FilterOperator,
    ScalarFieldType,
    type FieldSchema,
    type ParsedRule
} from '@ortha-cms/utils-server';
import { CONTENT_FIELD_TYPE, ENTRY_STATUS } from '@ortha-cms/content-server';
import { LOCALE_FALLBACK_DEFAULT } from '../../i18n.constants';
import { LocaleRegistryService } from '../../locales/services/locale-registry.service';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/** Virtual filter field: the group holds a row in this locale. */
const HAS_LOCALE = 'hasLocale';
/** Virtual filter field: the group is missing a row in this locale. */
const MISSING_LOCALE = 'missingLocale';
/** Virtual filter field: how many locale rows the group holds. */
const LOCALE_COUNT = 'localeCount';

/** Operators each virtual field admits (anything else is a 400). */
const LOCALE_FIELD_OPS: Record<string, ReadonlySet<string>> = {
    [HAS_LOCALE]: new Set<string>([
        FilterOperator.Eq,
        FilterOperator.Ne,
        FilterOperator.In,
        FilterOperator.Nin
    ]),
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
        private readonly validation: EntryValidationService
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
                    eq(s['workspaceId'], workspaceId),
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
     * sibling attaches to a real group. Runs before the create transaction —
     * the (benign) TOCTOU window is covered by the row staying valid and the
     * `(locale_group_id, locale)` unique index still guarding duplicates.
     */
    private async assertGroupExists(
        type: AnyContentType,
        localeGroupId: string,
        workspaceId: string
    ): Promise<void> {
        const table = type.table as unknown as ContentTable;
        const [row] = await this.db
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

    /** @inheritdoc */
    async afterUpdate(
        tx: EntryTransaction,
        type: AnyContentType,
        row: Record<string, unknown>,
        values: Record<string, unknown>,
        workspaceId: string
    ): Promise<Record<string, unknown>[]> {
        if (!type.i18n) return [];
        const sharedColumns = this.sharedColumns(type, values);
        if (!sharedColumns) return [];

        const table = type.table as unknown as ContentTable;
        // Only the columns this save actually carries. A field the caller
        // omitted is `undefined`, which `.set()` skips — so it must be left out
        // of the change predicate too, or it would compare against a missing
        // bind parameter.
        const written = Object.entries(sharedColumns).filter(
            ([, value]) => value !== undefined
        );
        if (!written.length) return [];

        // Only touch siblings whose shared values actually differ. The save's
        // values bag carries every field the caller sent, so an unconditional
        // UPDATE rewrote — and, now that the pipeline appends a revision per
        // touched row, re-versioned — every sibling on every save, even one
        // that only changed a localized field. `IS DISTINCT FROM` rather than
        // `<>` so a NULL on either side compares correctly.
        //
        // Each value is bound with **its column's own encoder** (`sql.param`),
        // the same mapping `.set()` applies below. Interpolating it bare made an
        // array-valued field (a `jsonb` multiselect, json, or a multiple media
        // field) expand into a parameter *list* — `IS DISTINCT FROM ($1, $2, $3)`
        // — which Postgres reads as a record and rejects with
        // `operator does not exist: jsonb = record`, failing every save of an
        // i18n type that carried one.
        const differs = or(
            ...written.map(
                ([column, value]) =>
                    sql`${table[column]} IS DISTINCT FROM ${sql.param(value, table[column])}`
            )
        );
        // Sync every sibling — including soft-deleted ones, so a later restore
        // comes back consistent with the group.
        //
        // A **published** sibling moves back to `draft`, exactly as the entry
        // the user edited does. Its shared values just changed, so its published
        // *version* is no longer what the row holds — leaving it `published`
        // made the same shared edit live in the untouched locales while still
        // pending in the edited one, and left its freshly-appended draft version
        // describing a row that claimed to be live. `published_at` is kept, so
        // the sibling reads as **Modified** (live content, unpublished changes)
        // rather than as a never-published draft. Publishing any locale is still
        // per-row; this only stops one from silently going live on another's save.
        const wasPublished = new Set(
            type.publishable
                ? (
                      (await tx
                          .select({ id: sql<string>`${table['id']}` })
                          .from(type.table)
                          .where(
                              and(
                                  eq(
                                      table['localeGroupId'],
                                      row['localeGroupId'] as string
                                  ),
                                  ne(table['id'], row['id'] as string),
                                  eq(table['workspaceId'], workspaceId),
                                  eq(table['status'], ENTRY_STATUS.Published),
                                  differs
                              )
                          )
                          .for('update')) as { id: string }[]
                  ).map((r) => r.id)
                : []
        );
        const siblings = (await tx
            .update(type.table)
            .set({
                ...sharedColumns,
                ...(type.publishable ? { status: ENTRY_STATUS.Draft } : {}),
                updatedAt: new Date()
            } as never)
            .where(
                and(
                    eq(table['localeGroupId'], row['localeGroupId'] as string),
                    ne(table['id'], row['id'] as string),
                    eq(table['workspaceId'], workspaceId),
                    differs
                )
            )
            .returning()) as Record<string, unknown>[];

        // A sibling that **was** published must stay valid after the shared
        // values land — re-validate its merged row and abort the whole save
        // otherwise. Drafts may be temporarily invalid (same rule as saving a
        // draft directly). The check reads the pre-write status captured above,
        // not the row's current one: the UPDATE has just demoted these to
        // `draft`, so testing the returned status would silently skip every one.
        for (const sibling of siblings) {
            if (!wasPublished.has(sibling['id'] as string)) continue;
            const result = this.validation.validate(
                type,
                toRecord(type, sibling).values
            );
            if (!result.valid) {
                throw new UnprocessableEntityException({
                    message:
                        `Shared fields would invalidate the published ` +
                        `"${sibling['locale'] as string}" translation`,
                    issues: result.issues
                });
            }
        }

        // Hand the rewritten siblings back so the entries pipeline appends a
        // revision for each. Their values moved in this transaction; without a
        // revision their history would skip the change entirely, and a later
        // "restore" of an older version would silently undo it.
        return siblings;
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
     * workspace-scoped and (on paranoid types) live-rows-only.
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
        // in the named locale(s).
        const localePredicate =
            rule.op === FilterOperator.In || rule.op === FilterOperator.Nin
                ? rule.op === FilterOperator.Nin
                    ? notInArray(s['locale'], rule.value as string[])
                    : inArray(s['locale'], rule.value as string[])
                : rule.op === FilterOperator.Ne
                  ? ne(s['locale'], rule.value as string)
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
     * The column bag of the type's **shared** (non-`localized`) fields, drawn
     * from a save's coerced values — what {@link afterUpdate} propagates to
     * siblings. `null` when the type has no shared column-backed field (then
     * there's nothing to sync). Join-backed relation links are per-row in this
     * milestone (copied at translation creation, not synced) — only fields
     * with a main-table column participate. A **single relation to an i18n
     * target** is per-locale (a shared FK would be a cross-locale link), so it's
     * excluded too — its FK stays independent per sibling.
     */
    private sharedColumns(
        type: AnyContentType,
        values: Record<string, unknown>
    ): Record<string, unknown> | null {
        const sharedFields = Object.entries(type.fields).filter(
            ([, spec]) =>
                !spec.localized &&
                !(
                    spec.type === CONTENT_FIELD_TYPE.Relation &&
                    (spec.relation?.many || spec.relation?.inverse)
                ) &&
                !isPerLocaleRelation(type, spec)
        );
        if (!sharedFields.length) return null;
        const allColumns = toColumns(type, values);
        const shared: Record<string, unknown> = {};
        for (const [name] of sharedFields) {
            shared[name] = allColumns[name];
        }
        return shared;
    }
}
