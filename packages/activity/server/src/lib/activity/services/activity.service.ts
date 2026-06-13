import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type {
    ActivityExecutor,
    ActivityKind,
    ActivityMeta,
    ActivityRecorder,
    ActivityRecordInput
} from '@ortha-cms/activity-contract';
import { activityEvents } from '../../schema';
import { DEFAULT_PAGE_SIZE, type SortableField } from '../activity.constants';
import type { ListActivityQueryDto } from '../dto/list-activity-query.dto';
import type {
    ActivityEventView,
    ActivityListView
} from '../types/activity-view';

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
        const where = this.listPredicate(query);
        const sortColumn = SORT_COLUMNS[query.sort ?? 'at'];
        const direction = query.order === 'asc' ? asc : desc;

        const [{ total }] = await this.db
            .select({ total: count() })
            .from(activityEvents)
            .where(where);

        const rows = await this.db
            .select({
                id: activityEvents.id,
                kind: activityEvents.kind,
                subjectType: activityEvents.subjectType,
                subjectId: activityEvents.subjectId,
                actorId: activityEvents.actorId,
                actorEmail: activityEvents.actorEmail,
                meta: activityEvents.meta,
                at: activityEvents.at
            })
            .from(activityEvents)
            .where(where)
            .orderBy(direction(sortColumn), desc(activityEvents.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        return {
            items: rows.map((row): ActivityEventView => ({
                ...row,
                kind: row.kind as ActivityKind,
                meta: row.meta as ActivityMeta | null
            })),
            total,
            page,
            pageSize
        };
    }

    /**
     * The combined `where` for the list: every supplied filter intersected
     * (AND). `and(undefined, …)` collapses to no filter, so an unfiltered list
     * scans everything.
     */
    private listPredicate(query: ListActivityQueryDto) {
        return and(
            query.subjectType
                ? eq(activityEvents.subjectType, query.subjectType)
                : undefined,
            query.subjectId
                ? eq(activityEvents.subjectId, query.subjectId)
                : undefined,
            query.actorId ? eq(activityEvents.actorId, query.actorId) : undefined,
            query.kind && query.kind.length > 0
                ? inArray(activityEvents.kind, query.kind)
                : undefined,
            this.actorEmailPredicate(query.actorEmail),
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
        const escaped = needle.replace(/[\\%_]/g, '\\$&');
        return ilike(activityEvents.actorEmail, `%${escaped}%`);
    }
}
