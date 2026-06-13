import type { Database } from '@ortha-cms/database';
import type { ActivityKind, ActivityMetaMap } from './activity-kinds';

/**
 * A recordable audit event. A distributed (per-kind) shape so `meta` is
 * type-checked against the chosen `kind` — e.g. `kind: 'user.role_changed'`
 * requires `meta: { from, to }`. `actorId`/`actorEmail` are nullable (a
 * system-initiated action has no actor); `at` defaults to now when omitted.
 */
export type ActivityRecordInput = {
    [K in ActivityKind]: {
        /** The event kind; selects the required {@link ActivityMetaMap} shape. */
        kind: K;
        /** The kind of entity acted upon (e.g. `'user'`, `'workspace'`). */
        subjectType: string;
        /** The acted-upon entity's id — `text`, not necessarily a uuid. */
        subjectId: string;
        /** Who performed it; `null`/omitted for system-initiated events. */
        actorId?: string | null;
        /** Frozen email snapshot of the actor at record time. */
        actorEmail?: string | null;
        /** Extra payload, typed per kind. Omit when the kind carries none. */
        meta?: ActivityMetaMap[K];
        /** When it happened; defaults to now if omitted. */
        at?: Date;
    };
}[ActivityKind];

/**
 * The minimal Drizzle executor `record` accepts: the root client or an open
 * transaction. Typing it as `Pick<Database, 'insert'>` lets a caller pass its
 * `tx` so the audit row commits in the **same** transaction as the mutation.
 */
export type ActivityExecutor = Pick<Database, 'insert'>;

/**
 * The emit-side port. `@ortha-cms/activity-server`'s `ActivityService`
 * implements it and binds it to {@link ACTIVITY_RECORDER}; foundational
 * plugins (identity) inject the **token**, not the concrete service, so they
 * never depend on `activity-server` — which keeps the package graph acyclic.
 */
export interface ActivityRecorder {
    /**
     * Appends one audit row. Pass `executor = tx` to record in-band with a
     * mutation; defaults to the root client and `at = now`.
     */
    record(input: ActivityRecordInput, executor?: ActivityExecutor): Promise<void>;
}

/**
 * DI token the host binds to the concrete {@link ActivityRecorder}. Inject it
 * with `@Optional()` so a plugin still boots if the activity plugin is absent.
 */
export const ACTIVITY_RECORDER = Symbol('ACTIVITY_RECORDER');
