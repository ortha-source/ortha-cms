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
                event(
                    'auth.signed_in',
                    'user',
                    TARGET_USER_ID,
                    {},
                    {
                        id: TARGET_USER_ID,
                        email: 'me@example.com'
                    }
                )
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

        it('user.password_changed → an audit row carrying the eviction count', () => {
            // BUG-identity-server-05: identity's aggregate raised this event
            // from the start, but no mapper existed, so a credential rotation
            // left the audit log completely silent.
            const row = toAuditRow(
                event(
                    'user.password_changed',
                    'user',
                    TARGET_USER_ID,
                    { sessionsRevoked: 3 },
                    { id: TARGET_USER_ID, email: 'me@example.com' }
                )
            );
            expect(row).toEqual({
                id: EVENT_ID,
                kind: 'user.password_changed',
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                actorId: TARGET_USER_ID,
                actorEmail: 'me@example.com',
                meta: { sessionsRevoked: 3 },
                at: AT
            });
        });

        it('records a password change that evicted nothing as a zero, not a gap', () => {
            const row = toAuditRow(
                event(
                    'user.password_changed',
                    'user',
                    TARGET_USER_ID,
                    { sessionsRevoked: 0 },
                    { id: TARGET_USER_ID, email: 'me@example.com' }
                )
            );
            expect(row?.meta).toEqual({ sessionsRevoked: 0 });
        });

        it('auth.signed_out → user.signed_out (actorEmail may be null)', () => {
            const row = toAuditRow(
                event(
                    'auth.signed_out',
                    'user',
                    TARGET_USER_ID,
                    {},
                    {
                        id: TARGET_USER_ID,
                        email: null
                    }
                )
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

    describe('API token lifecycle', () => {
        const TOKEN_ID = '99999999-9999-4999-8999-999999999999';

        it('api_token.created → token.created on an api_token subject', () => {
            const row = toAuditRow(
                event(
                    'api_token.created',
                    'api_token',
                    TOKEN_ID,
                    {
                        name: 'CI',
                        scope: 'read',
                        workspaceIds: [WORKSPACE_ID],
                        lookupPrefix: 'orthacms_abc123',
                        expiresAt: null
                    },
                    { id: TARGET_USER_ID, email: 'admin@example.com' }
                )
            );
            expect(row).toEqual({
                id: EVENT_ID,
                kind: 'token.created',
                subjectType: 'api_token',
                subjectId: TOKEN_ID,
                actorId: TARGET_USER_ID,
                actorEmail: 'admin@example.com',
                meta: {
                    name: 'CI',
                    scope: 'read',
                    workspaceIds: [WORKSPACE_ID],
                    lookupPrefix: 'orthacms_abc123'
                },
                at: AT
            });
        });

        it('api_token.revoked → token.revoked, same shape', () => {
            const row = toAuditRow(
                event(
                    'api_token.revoked',
                    'api_token',
                    TOKEN_ID,
                    {
                        name: 'CI',
                        scope: 'full',
                        workspaceIds: [WORKSPACE_ID],
                        lookupPrefix: 'orthacms_abc123'
                    },
                    { id: TARGET_USER_ID, email: 'admin@example.com' }
                )
            );
            expect(row).toMatchObject({
                kind: 'token.revoked',
                subjectType: 'api_token',
                subjectId: TOKEN_ID,
                meta: {
                    name: 'CI',
                    scope: 'full',
                    lookupPrefix: 'orthacms_abc123'
                }
            });
        });

        it('never carries a secret or a hash into the audit row', () => {
            // The mapper projects a fixed field set, so even a producer that
            // over-shares cannot leak a credential into the log — `api_tokens`
            // stores only a SHA-256 for exactly this reason, and the audit
            // table must not become the second copy.
            const row = toAuditRow(
                event('api_token.created', 'api_token', TOKEN_ID, {
                    name: 'CI',
                    scope: 'read',
                    workspaceIds: [],
                    lookupPrefix: 'orthacms_abc123',
                    secret: 'orthacms_the-actual-secret',
                    tokenHash: 'f'.repeat(64)
                })
            );
            expect(Object.keys(row?.meta ?? {}).sort()).toEqual([
                'lookupPrefix',
                'name',
                'scope',
                'workspaceIds'
            ]);
            expect(JSON.stringify(row)).not.toContain('the-actual-secret');
            expect(JSON.stringify(row)).not.toContain('f'.repeat(64));
        });
    });

    describe('content entry lifecycle', () => {
        it('maps a publish to a content_entry row carrying its type', () => {
            const row = toAuditRow(
                event('entry.published', 'content_entry', WORKSPACE_ID, {
                    contentType: 'article'
                })
            );
            expect(row).toMatchObject({
                kind: 'entry.published',
                subjectType: 'content_entry',
                subjectId: WORKSPACE_ID,
                meta: { contentType: 'article' }
            });
        });

        it('maps an unpublish the same way', () => {
            const row = toAuditRow(
                event('entry.unpublished', 'content_entry', WORKSPACE_ID, {
                    contentType: 'article'
                })
            );
            expect(row).toMatchObject({
                kind: 'entry.unpublished',
                subjectType: 'content_entry',
                meta: { contentType: 'article' }
            });
        });
    });

    describe('non-audited kinds', () => {
        it('returns null for an unmapped kind', () => {
            expect(
                toAuditRow(
                    event(
                        'workspace.something_else',
                        'workspace',
                        WORKSPACE_ID,
                        {}
                    )
                )
            ).toBeNull();
        });

        it('audits exactly the 23 expected kinds', () => {
            expect([...AUDITED_EVENT_KINDS].sort()).toEqual(
                [
                    'api_token.created',
                    'api_token.revoked',
                    'auth.signed_in',
                    'auth.signed_out',
                    'user.password_changed',
                    'entry.published',
                    'entry.unpublished',
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
