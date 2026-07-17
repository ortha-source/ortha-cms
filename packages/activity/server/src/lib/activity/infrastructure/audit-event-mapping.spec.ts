import {
    attachActor,
    createDomainEvent,
    type DomainEvent,
    type EventActor
} from '@ortha-cms/database';
import { IDENTITY_ACTIVITY_KINDS } from '@ortha-cms/identity-server';
import {
    AUDITED_EVENT_KINDS,
    toAuditRow,
    type AuditRow
} from './audit-event-mapping';

/**
 * Parity safety net (DB-free): for every audited domain event, the row
 * {@link toAuditRow} produces must equal the row the old in-band
 * `recorder.record(...)` wrote for the same action — same
 * `kind`/`subjectType`/`subjectId`/`actorId`/`actorEmail`/`meta`. This is how we
 * prove the outbox subscriber records identically, without standing up e2e.
 */

const EVENT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const AT = new Date('2026-07-17T12:00:00.000Z');
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_USER_ID = '33333333-3333-4333-8333-333333333333';

/** The acting admin — `attachActor` puts this on the event payload. */
const ACTOR: EventActor = { id: 'actor-1', email: 'admin@example.com' };

/**
 * Builds an event exactly as a producer does: `createDomainEvent` then
 * `attachActor` (the same enrichment the use-cases apply before appending to
 * the outbox).
 */
function event(
    kind: string,
    aggregateType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
    actor: EventActor = ACTOR
): DomainEvent {
    const [enriched] = attachActor(
        [
            createDomainEvent({
                eventId: EVENT_ID,
                kind,
                aggregateType,
                aggregateId,
                occurredAt: AT,
                payload
            })
        ],
        actor
    );
    return enriched;
}

/** The fixed fields shared by every produced row. */
function base(): Pick<AuditRow, 'id' | 'actorId' | 'actorEmail' | 'at'> {
    return {
        id: EVENT_ID,
        actorId: ACTOR.id,
        actorEmail: ACTOR.email,
        at: AT
    };
}

describe('toAuditRow — event → audit-row parity', () => {
    describe('workspaces (event kind === audit kind)', () => {
        it('workspace.created → { name, slug } against the workspace', () => {
            const row = toAuditRow(
                event('workspace.created', 'workspace', WORKSPACE_ID, {
                    name: 'Marketing',
                    slug: 'marketing'
                })
            );
            expect(row).toEqual({
                ...base(),
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CREATED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: { name: 'Marketing', slug: 'marketing' }
            });
        });

        it('workspace.updated → { fields }', () => {
            const row = toAuditRow(
                event('workspace.updated', 'workspace', WORKSPACE_ID, {
                    fields: ['name', 'color']
                })
            );
            expect(row).toMatchObject({
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_UPDATED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: { fields: ['name', 'color'] }
            });
        });

        it('workspace.archived → empty meta object (not null)', () => {
            const row = toAuditRow(
                event('workspace.archived', 'workspace', WORKSPACE_ID, {})
            );
            expect(row).toEqual({
                ...base(),
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_ARCHIVED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: {}
            });
        });

        it('workspace.unarchived → empty meta object', () => {
            const row = toAuditRow(
                event('workspace.unarchived', 'workspace', WORKSPACE_ID, {})
            );
            expect(row).toMatchObject({
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_UNARCHIVED,
                meta: {}
            });
        });

        it('workspace.deleted → { name, slug }', () => {
            const row = toAuditRow(
                event('workspace.deleted', 'workspace', WORKSPACE_ID, {
                    name: 'Marketing',
                    slug: 'marketing'
                })
            );
            expect(row).toMatchObject({
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_DELETED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: { name: 'Marketing', slug: 'marketing' }
            });
        });

        it('workspace.member_added → subject is the USER, meta { workspaceId, email }', () => {
            const row = toAuditRow(
                event('workspace.member_added', 'workspace', WORKSPACE_ID, {
                    userId: TARGET_USER_ID,
                    email: 'bob@example.com'
                })
            );
            expect(row).toEqual({
                ...base(),
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED,
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                meta: { workspaceId: WORKSPACE_ID, email: 'bob@example.com' }
            });
        });

        it('workspace.member_removed → subject is the USER, nullable email', () => {
            const row = toAuditRow(
                event('workspace.member_removed', 'workspace', WORKSPACE_ID, {
                    userId: TARGET_USER_ID,
                    email: null
                })
            );
            expect(row).toEqual({
                ...base(),
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED,
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                meta: { workspaceId: WORKSPACE_ID, email: null }
            });
        });

        it('workspace.content_granted → { slug, kind }', () => {
            const row = toAuditRow(
                event('workspace.content_granted', 'workspace', WORKSPACE_ID, {
                    slug: 'blog_post',
                    kind: 'collection'
                })
            );
            expect(row).toMatchObject({
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CONTENT_GRANTED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: { slug: 'blog_post', kind: 'collection' }
            });
        });

        it('workspace.content_revoked → { slug }', () => {
            const row = toAuditRow(
                event('workspace.content_revoked', 'workspace', WORKSPACE_ID, {
                    slug: 'blog_post'
                })
            );
            expect(row).toMatchObject({
                kind: IDENTITY_ACTIVITY_KINDS.WORKSPACE_CONTENT_REVOKED,
                subjectType: 'workspace',
                subjectId: WORKSPACE_ID,
                meta: { slug: 'blog_post' }
            });
        });
    });

    describe('users (member.* → user.*)', () => {
        it('member.invited → user.invited { email }', () => {
            const row = toAuditRow(
                event('member.invited', 'member', MEMBER_ID, {
                    email: 'ada@example.com'
                })
            );
            expect(row).toEqual({
                ...base(),
                kind: 'user.invited',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: { email: 'ada@example.com' }
            });
        });

        it('member.invite_resent → user.invite_resent { email }', () => {
            const row = toAuditRow(
                event('member.invite_resent', 'member', MEMBER_ID, {
                    email: 'ada@example.com'
                })
            );
            expect(row).toMatchObject({
                kind: 'user.invite_resent',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: { email: 'ada@example.com' }
            });
        });

        it('member.removed → user.invite_revoked { email }', () => {
            const row = toAuditRow(
                event('member.removed', 'member', MEMBER_ID, {
                    email: 'ada@example.com'
                })
            );
            expect(row).toMatchObject({
                kind: 'user.invite_revoked',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: { email: 'ada@example.com' }
            });
        });

        it('member.profile_updated → user.profile_updated { name: { from, to } }', () => {
            const row = toAuditRow(
                event('member.profile_updated', 'member', MEMBER_ID, {
                    name: { from: 'Ada', to: 'Ada Lovelace' }
                })
            );
            expect(row).toMatchObject({
                kind: 'user.profile_updated',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: { name: { from: 'Ada', to: 'Ada Lovelace' } }
            });
        });

        it('member.role_changed → user.role_changed { from, to }', () => {
            const row = toAuditRow(
                event('member.role_changed', 'member', MEMBER_ID, {
                    from: 'editor',
                    to: 'admin'
                })
            );
            expect(row).toMatchObject({
                kind: 'user.role_changed',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: { from: 'editor', to: 'admin' }
            });
        });

        it('member.disabled → user.suspended, null meta', () => {
            const row = toAuditRow(
                event('member.disabled', 'member', MEMBER_ID, {})
            );
            expect(row).toEqual({
                ...base(),
                kind: 'user.suspended',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: null
            });
        });

        it('member.reactivated → user.reactivated, null meta', () => {
            const row = toAuditRow(
                event('member.reactivated', 'member', MEMBER_ID, {})
            );
            expect(row).toEqual({
                ...base(),
                kind: 'user.reactivated',
                subjectType: 'user',
                subjectId: MEMBER_ID,
                meta: null
            });
        });
    });

    describe('identity (auth.* → user.*, actor is the signer)', () => {
        it('auth.signed_in → user.signed_in, actor = the user', () => {
            const row = toAuditRow(
                event('auth.signed_in', 'user', TARGET_USER_ID, {}, {
                    id: TARGET_USER_ID,
                    email: 'me@example.com'
                })
            );
            expect(row).toEqual({
                id: EVENT_ID,
                kind: IDENTITY_ACTIVITY_KINDS.USER_SIGNED_IN,
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                actorId: TARGET_USER_ID,
                actorEmail: 'me@example.com',
                meta: null,
                at: AT
            });
        });

        it('auth.signed_out → user.signed_out (actorEmail may be null)', () => {
            const row = toAuditRow(
                event('auth.signed_out', 'user', TARGET_USER_ID, {}, {
                    id: TARGET_USER_ID,
                    email: null
                })
            );
            expect(row).toEqual({
                id: EVENT_ID,
                kind: IDENTITY_ACTIVITY_KINDS.USER_SIGNED_OUT,
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                actorId: TARGET_USER_ID,
                actorEmail: null,
                meta: null,
                at: AT
            });
        });
    });

    describe('non-audited kinds', () => {
        it('returns null for an unmapped kind', () => {
            expect(
                toAuditRow(
                    event('workspace.something_else', 'workspace', WORKSPACE_ID, {})
                )
            ).toBeNull();
        });

        it('audits exactly the 18 expected kinds', () => {
            expect([...AUDITED_EVENT_KINDS].sort()).toEqual(
                [
                    'auth.signed_in',
                    'auth.signed_out',
                    'member.disabled',
                    'member.invite_resent',
                    'member.invited',
                    'member.profile_updated',
                    'member.reactivated',
                    'member.removed',
                    'member.role_changed',
                    'workspace.archived',
                    'workspace.content_granted',
                    'workspace.content_revoked',
                    'workspace.created',
                    'workspace.deleted',
                    'workspace.member_added',
                    'workspace.member_removed',
                    'workspace.unarchived',
                    'workspace.updated'
                ].sort()
            );
        });
    });
});
