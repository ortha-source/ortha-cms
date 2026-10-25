import { Injectable } from '@nestjs/common';
import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lte,
    or
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { applyFilterTree, parseFilterTree } from '@orthacms/utils-server';
import type {
    ActivityExecutor,
    ActivityRecorder,
    ActivityRecordInput
} from '@orthacms/identity-server';
import { activityEvents } from '../../schema';
import { ACTIVITY_FILTER_SCHEMA } from '../activity-filter';
import {
    DEFAULT_PAGE_SIZE,
    EXPORT_MAX_ROWS,
    type SortableField
} from '../activity.constants';
import type { ListActivityQueryDto } from '../dto/list-activity-query.dto';
import type {
    ActivityEventView,
    ActivityListView
} from '../types/activity-view';

/**
 * The columns every read selects — the row minus `created_at`, which never
 * reaches the wire (`activity:I-20`). One object, so the page and the export
 * cannot disagree about what a row is.
 */
const VIEW_COLUMNS = {
    id: activityEvents.id,
    kind: activityEvents.kind,
    subjectType: activityEvents.subjectType,
    subjectId: activityEvents.subjectId,
    subjectLabel: activityEvents.subjectLabel,
    actorId: activityEvents.actorId,
    actorType: activityEvents.actorType,
    actorEmail: activityEvents.actorEmail,
    workspaceId: activityEvents.workspaceId,
    meta: activityEvents.meta,
    at: activityEvents.at
} as const;

/** Escapes LIKE's metacharacters, so a needle matches literally (`I-19`). */
function likeEscape(needle: string): string {
    return needle.replace(/[\\%_]/g, '\\$&');
}

/** The sortable wire fields mapped to their `activity_events` columns. */
const SORT_COLUMNS = {
    at: activityEvents.at,
    kind: activityEvents.kind
} as const satisfies Record<SortableField, unknown>;

/**
 * Owns the audit trail: appends events (`record`) and serves the paginated
 * read API (`list`). Implements {@link ActivityRecorder} so foundational
 * plugins can record via the `ACTIVITY_RECORDER` token without depending on
 * this package. Uses the shared Drizzle client directly (no repository
 * wrapper, by repo convention).
 */
@Injectable()
export class ActivityService implements ActivityRecorder {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Appends one audit row. Pass `executor = tx` to record **in-band** with a
     * mutation, so the audit row commits iff the mutation does; defaults to the
     * root client. `at` defaults to now; `actorId`/`actorEmail`/`meta` are
     * nullable.
     *
     * @deprecated Wave 3 moved auditing onto the outbox `AuditEventSubscriber`,
     * the single live writer. This method (and the `ACTIVITY_RECORDER` binding)
     * is retained only for a stable public surface — no caller writes through it
     * anymore. Emit a domain event and let the subscriber record it instead.
     */
    async record(
        input: ActivityRecordInput,
        executor: ActivityExecutor = this.db
    ): Promise<void> {
        await executor.insert(activityEvents).values({
            kind: input.kind,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            actorId: input.actorId ?? null,
            actorEmail: input.actorEmail ?? null,
            meta: input.meta ?? null,
            at: input.at ?? new Date()
        });
    }

    /**
     * One page of events matching the filters, with a stable order: the
     * whitelisted sort column (default `at desc`) plus an `id` tiebreaker so
     * paging is deterministic across equal timestamps. `created_at` is never
     * selected — the immutable write time stays off the wire.
     */
    async list(query: ListActivityQueryDto): Promise<ActivityListView> {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
        const where = await this.listWhere(query);
        const sortColumn = SORT_COLUMNS[query.sort ?? 'at'];
        const direction = query.order === 'asc' ? asc : desc;

        // Count and page rows share the same WHERE but are otherwise
        // independent; run them concurrently so a list request pays the max
        // of the two query times, not their sum.
        const [[{ total }], rows] = await Promise.all([
            this.db
                .select({ total: count() })
                .from(activityEvents)
                .where(where),
            this.db
                .select(VIEW_COLUMNS)
                .from(activityEvents)
                .where(where)
                .orderBy(direction(sortColumn), desc(activityEvents.id))
                .limit(pageSize)
                .offset((page - 1) * pageSize)
        ]);

        return {
            items: rows.map(toView),
            total,
            page,
            pageSize
        };
    }

    /**
     * Every event matching the filters, for the CSV export — the same `where`
     * and the same order as {@link list}, without the paging, capped at
     * `limit` rows (newest first under the default sort, so a capped export
     * keeps the most recent).
     *
     * `total` is the uncapped count, so the caller can say when the file is
     * not the whole answer rather than let a truncated audit export pass for a
     * complete one.
     */
    async exportRows(
        query: ListActivityQueryDto,
        limit: number = EXPORT_MAX_ROWS
    ): Promise<{ rows: ActivityEventView[]; total: number }> {
        const where = await this.listWhere(query);
        const sortColumn = SORT_COLUMNS[query.sort ?? 'at'];
        const direction = query.order === 'asc' ? asc : desc;
        const [[{ total }], rows] = await Promise.all([
            this.db
                .select({ total: count() })
                .from(activityEvents)
                .where(where),
            this.db
                .select(VIEW_COLUMNS)
                .from(activityEvents)
                .where(where)
                .orderBy(direction(sortColumn), desc(activityEvents.id))
                .limit(limit)
        ]);
        return { rows: rows.map(toView), total };
    }

    /**
     * The full `where` for the list: the structured params (`listPredicate`)
     * AND-ed with the optional query-builder `?filter=` tree. The filter is
     * parsed and translated against {@link ACTIVITY_FILTER_SCHEMA}; a malformed
     * filter throws a `FilterException` (HTTP 400). `and(undefined, …)`
     * collapses cleanly, so an unfiltered list still scans everything.
     */
    private async listWhere(query: ListActivityQueryDto) {
        const tree = parseFilterTree(query.filter, ACTIVITY_FILTER_SCHEMA);
        const filterSql = await applyFilterTree(
            tree,
            ACTIVITY_FILTER_SCHEMA,
            activityEvents,
            this.db
        );
        return and(this.listPredicate(query), filterSql);
    }

    /**
     * The structured-param `where` for the list: every supplied filter
     * intersected (AND). `and(undefined, …)` collapses to no filter, so an
     * unfiltered list scans everything.
     */
    private listPredicate(query: ListActivityQueryDto) {
        return and(
            query.subjectType
                ? eq(activityEvents.subjectType, query.subjectType)
                : undefined,
            query.subjectId
                ? eq(activityEvents.subjectId, query.subjectId)
                : undefined,
            query.actorId
                ? eq(activityEvents.actorId, query.actorId)
                : undefined,
            query.actorType
                ? eq(activityEvents.actorType, query.actorType)
                : undefined,
            query.workspaceId
                ? eq(activityEvents.workspaceId, query.workspaceId)
                : undefined,
            query.kind && query.kind.length > 0
                ? inArray(activityEvents.kind, query.kind)
                : undefined,
            this.actorEmailPredicate(query.actorEmail),
            this.searchPredicate(query.q),
            query.from
                ? gte(activityEvents.at, new Date(query.from))
                : undefined,
            query.to ? lte(activityEvents.at, new Date(query.to)) : undefined
        );
    }

    /**
     * Case-insensitive substring match on the actor email snapshot, or
     * `undefined` for no filter. LIKE metacharacters in the needle are escaped
     * so a literal `%`/`_` search behaves literally.
     */
    private actorEmailPredicate(search: string | undefined) {
        const needle = search?.trim();
        if (!needle) {
            return undefined;
        }
        return ilike(activityEvents.actorEmail, `%${likeEscape(needle)}%`);
    }

    /**
     * The free-text `?q=` clause, or `undefined` for no search: one
     * case-insensitive substring match OR-ed across the readable, frozen
     * columns — actor email, subject label, subject id, subject type and kind.
     * Escaped like the actor search (`activity:I-19`).
     *
     * The kind is matched a second time with the needle's whitespace read as
     * `_`, because a reader types "role changed" or "signed in" and the column
     * holds `user.role_changed` / `user.signed_in`. `meta` is deliberately not
     * a column here (`activity:I-16`); what a reader calls a record is in
     * `subject_label`.
     */
    private searchPredicate(search: string | undefined) {
        const needle = search?.trim();
        if (!needle) {
            return undefined;
        }
        const pattern = `%${likeEscape(needle)}%`;
        const kindNeedle = needle.replace(/\s+/g, '_');
        return or(
            ilike(activityEvents.actorEmail, pattern),
            ilike(activityEvents.subjectLabel, pattern),
            ilike(activityEvents.subjectId, pattern),
            ilike(activityEvents.subjectType, pattern),
            ilike(activityEvents.kind, pattern),
            kindNeedle === needle
                ? undefined
                : // The underscore here is literal: escaped like any other.
                  ilike(activityEvents.kind, `%${likeEscape(kindNeedle)}%`)
        );
    }
}

/** A selected row as the wire view: `meta` narrowed from Drizzle's `unknown`. */
function toView(row: {
    [K in keyof typeof VIEW_COLUMNS]: unknown;
}): ActivityEventView {
    return {
        ...(row as Omit<ActivityEventView, 'meta'>),
        meta: (row.meta as Record<string, unknown> | null) ?? null
    };
}
