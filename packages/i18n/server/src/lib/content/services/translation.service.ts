import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { and, eq, isNull, sql, type AnyColumn } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { lockWorkspaceShared } from '@ortha-cms/identity-server';
import { isUniqueViolation } from '@ortha-cms/utils-server';
import {
    CONTENT_FIELD_TYPE,
    ENTRY_STATUS,
    toRecord,
    type AnyContentType,
    type EntryRecord
} from '@ortha-cms/content-server';
import { LocaleRegistryService } from '../../locales/services/locale-registry.service';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * Creates translations: a new sibling row in a target locale, joined to the
 * source entry's translation group. The whole copy — field columns and every
 * owning many-relation's join rows — runs in one transaction, so a
 * translation never lands half-linked.
 */
@Injectable()
export class TranslationService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly locales: LocaleRegistryService
    ) {}

    /**
     * Create the `targetLocale` sibling of entry `sourceId`:
     *
     * - Copies **every** field column from the source row — localized and
     *   shared alike — as the translation's starting point (localized values
     *   are then edited per locale; shared ones stay synced by the update
     *   pipeline).
     * - Same `locale_group_id`; fresh id/timestamps; a publishable type
     *   starts as a **draft** regardless of the source's status.
     * - Copies each owning many-relation's join rows (same targets, same
     *   order) — a starting point too, per-row from then on.
     *
     * 400 on a non-i18n type or unknown locale; 404 when the source is
     * missing (or soft-deleted) in this workspace; **409** when the group
     * already holds that locale — the `(locale_group_id, locale)` unique
     * index is the arbiter, so a concurrent duplicate loses cleanly instead
     * of racing a pre-check.
     */
    async create(
        type: AnyContentType,
        sourceId: string,
        targetLocale: string,
        workspaceId: string
    ): Promise<EntryRecord> {
        if (!type.i18n) {
            throw new BadRequestException(
                `Content type "${type.name}" is not localized.`
            );
        }
        const target = this.locales.get(targetLocale);
        if (!target) {
            throw new BadRequestException(
                `Unknown locale "${targetLocale}".`
            );
        }

        const table = type.table as unknown as ContentTable;
        const [source] = (await this.db
            .select()
            .from(type.table)
            .where(
                and(
                    eq(table['id'], sourceId),
                    eq(table['workspaceId'], workspaceId),
                    ...(type.paranoid ? [isNull(table['deletedAt'])] : [])
                )
            )
            .limit(1)) as Record<string, unknown>[];
        if (!source) {
            throw new NotFoundException(
                `No entry "${sourceId}" on content type "${type.name}".`
            );
        }
        if ((source['locale'] as string) === target.slug) {
            throw new ConflictException(
                `Entry "${sourceId}" already is the "${target.slug}" translation.`
            );
        }

        try {
            const row = await this.db.transaction(async (tx) => {
                await lockWorkspaceShared(tx, workspaceId);
                const [inserted] = await tx
                    .insert(type.table)
                    .values({
                        ...this.copiedFieldColumns(type, source),
                        workspaceId,
                        locale: target.slug,
                        localeGroupId: source['localeGroupId'],
                        ...(type.publishable
                            ? { status: ENTRY_STATUS.Draft, publishedAt: null }
                            : {})
                    } as never)
                    .returning();
                const newId = (inserted as Record<string, unknown>)[
                    'id'
                ] as string;
                // Copy each owning many-relation's join rows — same targets,
                // same order (position), new source.
                for (const joinTable of Object.values(type.joinTables)) {
                    await tx.execute(sql`
                        insert into ${joinTable} (source_id, target_id, position)
                        select ${newId}, target_id, position
                        from ${joinTable}
                        where source_id = ${sourceId}
                    `);
                }
                return inserted as Record<string, unknown>;
            });
            return toRecord(type, row);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new ConflictException(
                    `A "${target.slug}" translation already exists for this entry.`
                );
            }
            throw error;
        }
    }

    /**
     * The source row's field columns, keyed by table property name — every
     * field that owns a main-table column (scalars + single-relation FKs;
     * many/inverse relations live in join tables, copied separately). Raw
     * column values pass through untouched, so the copy can't drift through a
     * coercion round-trip.
     */
    private copiedFieldColumns(
        type: AnyContentType,
        source: Record<string, unknown>
    ): Record<string, unknown> {
        const columns: Record<string, unknown> = {};
        for (const [name, spec] of Object.entries(type.fields)) {
            if (
                spec.type === CONTENT_FIELD_TYPE.Relation &&
                (spec.relation?.many || spec.relation?.inverse)
            )
                continue;
            columns[name] = source[name];
        }
        return columns;
    }
}
