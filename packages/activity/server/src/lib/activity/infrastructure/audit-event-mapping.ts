import type { DomainEvent } from '@ortha-cms/database';
import { IDENTITY_ACTIVITY_KINDS } from '@ortha-cms/identity-server';

/**
 * The values one audit row needs, derived purely from a {@link DomainEvent}.
 * Mirrors an `activity_events` insert: `id` is the **event's** id (so a
 * re-delivered event maps to the same row — the subscriber inserts it
 * `ON CONFLICT DO NOTHING` for idempotency), and `at` is the event's domain
 * time.
 */
export interface AuditRow {
    /** Primary key = the source event id, making redelivery idempotent. */
    id: string;
    /** The `user.*` / `workspace.*` audit kind (see the mapping table below). */
    kind: string;
    /** The kind of entity acted upon (`'user'` / `'workspace'`). */
    subjectType: string;
    /** The acted-upon entity's id (text). */
    subjectId: string;
    /** Who performed it, or `null` for a system-initiated event. */
    actorId: string | null;
    /** Frozen actor email snapshot, or `null`. */
    actorEmail: string | null;
    /** Open per-kind payload, or `null` when the kind carries none. */
    meta: Record<string, unknown> | null;
    /** Logical event time (the event's `occurredAt`). */
    at: Date;
}

/** What a per-kind mapper decides — the audit-specific bits of the row. */
interface AuditFacet {
    kind: string;
    subjectType: string;
    subjectId: string;
    meta: Record<string, unknown> | null;
}

/**
 * The **user.\*** audit kinds owned by the users context
 * (`USER_ACTIVITY_KINDS` in `@ortha-cms/users-server`). Duplicated here as
 * literals rather than imported, so the audit sink stays decoupled from every
 * producer (activity depends on identity only); the parity unit test pins these
 * strings against the exact rows the old in-band recorder wrote.
 */
const USER_AUDIT_KINDS = {
    INVITED: 'user.invited',
    INVITE_RESENT: 'user.invite_resent',
    INVITE_REVOKED: 'user.invite_revoked',
    PROFILE_UPDATED: 'user.profile_updated',
    ROLE_CHANGED: 'user.role_changed',
    SUSPENDED: 'user.suspended',
    REACTIVATED: 'user.reactivated',
    /**
     * A credential rotation. Unlike the kinds above this one has no in-band
     * predecessor to stay bug-compatible with — `user.password_changed` was
     * raised on the outbox by identity's aggregate but nothing mapped it, so
     * the log recorded nothing at all when a password changed
     * (BUG-identity-server-05).
     */
    PASSWORD_CHANGED: 'user.password_changed'
} as const;

/** Reads a payload field as a string (or `null` when absent/nullish). */
function nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/** A `'user'`-subject facet whose subject is the event's aggregate. */
function userSubject(
    event: DomainEvent,
    kind: string,
    meta: Record<string, unknown> | null
): AuditFacet {
    return { kind, subjectType: 'user', subjectId: event.aggregateId, meta };
}

/** A `'workspace'`-subject facet whose subject is the event's aggregate. */
function workspaceSubject(
    event: DomainEvent,
    meta: Record<string, unknown> | null
): AuditFacet {
    // Workspace audit kinds are identical strings to their event kinds
    // (identity owns them via IDENTITY_ACTIVITY_KINDS), so the event kind is the
    // audit kind.
    return {
        kind: event.kind,
        subjectType: 'workspace',
        subjectId: event.aggregateId,
        meta
    };
}

/**
 * A `'content_entry'`-subject facet. The audit kind mirrors the event kind
 * (`entry.published` / `entry.unpublished`), and the entry's content type rides
 * in `meta` so the log can name *what* was published without joining anything.
 */
function entrySubject(event: DomainEvent): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'content_entry',
        subjectId: event.aggregateId,
        meta: { contentType: nullableString(event.payload.contentType) }
    };
}

/**
 * An `'api_token'`-subject facet. The subject is the token, and the acting
 * admin arrives separately as the actor.
 *
 * `meta` records what a reviewer needs to reason about the credential — its
 * label, its scope, its workspace bucket, and the non-secret `lookupPrefix`
 * that identifies it in the admin list. It deliberately carries **neither the
 * plaintext nor the hash**: `api_tokens` stores only a SHA-256 precisely so a
 * read of another table yields nothing usable, and the audit log is another
 * table.
 */
function apiTokenSubject(event: DomainEvent, auditKind: string): AuditFacet {
    const payload = event.payload;
    return {
        kind: auditKind,
        subjectType: 'api_token',
        subjectId: event.aggregateId,
        meta: {
            name: nullableString(payload.name),
            scope: nullableString(payload.scope),
            workspaceIds: payload.workspaceIds ?? [],
            lookupPrefix: nullableString(payload.lookupPrefix)
        }
    };
}

/** A workspace membership facet — subject is the affected **user**, not the workspace. */
function membershipSubject(event: DomainEvent, auditKind: string): AuditFacet {
    const payload = event.payload;
    return {
        kind: auditKind,
        subjectType: 'user',
        subjectId: nullableString(payload.userId) ?? '',
        meta: {
            workspaceId: event.aggregateId,
            email: nullableString(payload.email)
        }
    };
}

/**
 * The event-kind → audit-facet table. Each entry reproduces **exactly** the row
 * the old in-band `recorder.record(...)` wrote for that action:
 *
 * | domain event               | audit kind                | subject / meta                                   |
 * | -------------------------- | ------------------------- | ------------------------------------------------ |
 * | `workspace.created`        | `workspace.created`       | workspace / `{ name, slug }`                      |
 * | `workspace.updated`        | `workspace.updated`       | workspace / `{ fields }`                          |
 * | `workspace.archived`       | `workspace.archived`      | workspace / `{}`                                  |
 * | `workspace.unarchived`     | `workspace.unarchived`    | workspace / `{}`                                  |
 * | `workspace.deleted`        | `workspace.deleted`       | workspace / `{ name, slug }`                      |
 * | `workspace.member_added`   | `workspace.member_added`  | **user** / `{ workspaceId, email }`              |
 * | `workspace.member_removed` | `workspace.member_removed`| **user** / `{ workspaceId, email }`              |
 * | `workspace.content_granted`| `workspace.content_granted`| workspace / `{ slug, kind }`                     |
 * | `workspace.content_revoked`| `workspace.content_revoked`| workspace / `{ slug }`                           |
 * | `member.invited`           | `user.invited`            | user / `{ email }`                               |
 * | `member.invite_resent`     | `user.invite_resent`      | user / `{ email }`                               |
 * | `member.removed`           | `user.invite_revoked`     | user / `{ email }`                               |
 * | `member.profile_updated`   | `user.profile_updated`    | user / `{ name: { from, to } }`                  |
 * | `member.role_changed`      | `user.role_changed`       | user / `{ from, to }`                            |
 * | `member.disabled`          | `user.suspended`          | user / `null`                                    |
 * | `member.reactivated`       | `user.reactivated`        | user / `null`                                    |
 * | `user.password_changed`    | `user.password_changed`   | user / `{ sessionsRevoked }`                     |
 * | `api_token.created`        | `token.created`           | api_token / `{ name, scope, workspaceIds, lookupPrefix }` |
 * | `api_token.revoked`        | `token.revoked`           | api_token / same shape                           |
 * | `auth.signed_in`           | `user.signed_in`          | user / `null`                                    |
 * | `auth.signed_out`          | `user.signed_out`         | user / `null`                                    |
 * | `entry.published`          | `entry.published`         | content_entry / `{ contentType }`                |
 * | `entry.unpublished`        | `entry.unpublished`       | content_entry / `{ contentType }`                |
 *
 * The actor (`actorId`/`actorEmail`) is not here — it rides on the event payload
 * (`attachActor`) and is read uniformly by {@link toAuditRow}.
 */
const FACET_MAPPERS: Record<string, (event: DomainEvent) => AuditFacet> = {
    'workspace.created': (e) =>
        workspaceSubject(e, {
            name: nullableString(e.payload.name),
            slug: nullableString(e.payload.slug)
        }),
    'workspace.updated': (e) =>
        workspaceSubject(e, { fields: e.payload.fields ?? [] }),
    'workspace.archived': (e) => workspaceSubject(e, {}),
    'workspace.unarchived': (e) => workspaceSubject(e, {}),
    'workspace.deleted': (e) =>
        workspaceSubject(e, {
            name: nullableString(e.payload.name),
            slug: nullableString(e.payload.slug)
        }),
    'workspace.member_added': (e) =>
        membershipSubject(e, IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED),
    'workspace.member_removed': (e) =>
        membershipSubject(e, IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED),
    'workspace.content_granted': (e) =>
        workspaceSubject(e, {
            slug: nullableString(e.payload.slug),
            kind: nullableString(e.payload.kind)
        }),
    'workspace.content_revoked': (e) =>
        workspaceSubject(e, { slug: nullableString(e.payload.slug) }),

    'member.invited': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITED, {
            email: nullableString(e.payload.email)
        }),
    'member.invite_resent': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITE_RESENT, {
            email: nullableString(e.payload.email)
        }),
    'member.removed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITE_REVOKED, {
            email: nullableString(e.payload.email)
        }),
    'member.profile_updated': (e) =>
        userSubject(e, USER_AUDIT_KINDS.PROFILE_UPDATED, {
            name: e.payload.name ?? null
        }),
    'member.role_changed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.ROLE_CHANGED, {
            from: nullableString(e.payload.from),
            to: nullableString(e.payload.to)
        }),
    'member.disabled': (e) => userSubject(e, USER_AUDIT_KINDS.SUSPENDED, null),
    'member.reactivated': (e) =>
        userSubject(e, USER_AUDIT_KINDS.REACTIVATED, null),

    // Credential rotation. The kind is passed straight through (identity's
    // event kind and the audit kind are the same string), and `meta` records
    // how many live sessions the change evicted — the number a security review
    // actually wants: "the password changed AND N devices were signed out".
    'user.password_changed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.PASSWORD_CHANGED, {
            sessionsRevoked: e.payload.sessionsRevoked ?? null
        }),

    'auth.signed_in': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SIGNED_IN, null),
    'auth.signed_out': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SIGNED_OUT, null),

    // External-API bearer tokens. Nothing mapped these before, so minting and
    // revoking a long-lived key to workspace content left the log completely
    // silent (BUG-identity-server-01) — the audit trail could not answer "who
    // issued this credential, when, and scoped to what".
    'api_token.created': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_CREATED),
    'api_token.revoked': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_REVOKED),

    // Content publish lifecycle. `content-server` has raised these on the outbox
    // since the entry aggregate was introduced — its own comment anticipated
    // this subscriber — but nothing consumed them, so the log carried no content
    // activity at all.
    'entry.published': entrySubject,
    'entry.unpublished': entrySubject
};

/**
 * Every event kind the activity subscriber audits — the dispatcher delivers
 * only these to it.
 */
export const AUDITED_EVENT_KINDS = Object.keys(
    FACET_MAPPERS
) as readonly string[];

/** Reads the acting user off the event payload (`attachActor`'s `actor` key). */
function readActor(payload: Record<string, unknown>): {
    id: string | null;
    email: string | null;
} {
    const actor = payload.actor as
        | { id?: unknown; email?: unknown }
        | undefined;
    return {
        id: nullableString(actor?.id),
        email: nullableString(actor?.email)
    };
}

/**
 * Maps a domain event to the audit row it should produce, or `null` when the
 * kind is not audited. Pure and DB-free — the safety-net unit test asserts each
 * kind's row equals what the old in-band recorder wrote.
 */
export function toAuditRow(event: DomainEvent): AuditRow | null {
    const mapper = FACET_MAPPERS[event.kind];
    if (!mapper) {
        return null;
    }
    const facet = mapper(event);
    const actor = readActor(event.payload);
    return {
        id: event.eventId,
        kind: facet.kind,
        subjectType: facet.subjectType,
        subjectId: facet.subjectId,
        actorId: actor.id,
        actorEmail: actor.email,
        meta: facet.meta,
        at: event.occurredAt
    };
}
