import {
    attachActor,
    createDomainEvent,
    type DomainEvent,
    type EventActor
} from '@orthacms/database';
import { IDENTITY_ACTIVITY_KINDS } from '@orthacms/identity-server';
import {
    AUDITED_EVENT_KINDS,
    toAuditRow,
    UnmappableAuditEventError,
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

/**
 * The fixed fields shared by every produced row.
 *
 * `actorType` is `'user'` on all of them: `attachActor` defaults it, because
 * until API tokens could act nothing but a person ever could. `workspaceId` is
 * `null` unless the event's own payload names one — the column is filled from
 * `payload.workspaceId`, and most of these kinds belong to no workspace at all.
 */
function base(): Pick<
    AuditRow,
    'id' | 'actorId' | 'actorType' | 'actorEmail' | 'workspaceId' | 'at'
> {
    return {
        id: EVENT_ID,
        actorId: ACTOR.id,
        actorType: 'user',
        actorEmail: ACTOR.email,
        workspaceId: null,
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

        it.each(['workspace.member_added', 'workspace.member_removed'])(
            '%s refuses a payload with no userId rather than writing an empty subject',
            (kind) => {
                const bad = event(kind, 'workspace', WORKSPACE_ID, {
                    email: 'bob@example.com'
                });
                // `subject_id` is `text NOT NULL`, so `''` inserts cleanly and
                // produces a row naming an action, a workspace and an actor but
                // no subject — unreadable, and unrepairable downstream.
                expect(() => toAuditRow(bad)).toThrow(
                    UnmappableAuditEventError
                );
                expect(() => toAuditRow(bad)).toThrow(/payload\.userId/);
            }
        );

        it('a non-string userId is refused too (not coerced)', () => {
            expect(() =>
                toAuditRow(
                    event('workspace.member_added', 'workspace', WORKSPACE_ID, {
                        userId: 12345,
                        email: 'bob@example.com'
                    })
                )
            ).toThrow(UnmappableAuditEventError);
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

        it('member.password_reset_issued → user.password_reset_issued { email }', () => {
            const row = toAuditRow(
                event('member.password_reset_issued', 'member', MEMBER_ID, {
                    email: 'ada@example.com'
                })
            );
            expect(row).toMatchObject({
                kind: 'user.password_reset_issued',
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
                actorType: 'user',
                workspaceId: null,
                actorEmail: 'me@example.com',
                // Where the sign-in came from. Both are null on an event that
                // carried no session context — "not captured", which a reader
                // should be able to tell from "not looked at".
                meta: { ipAddress: null, userAgent: null },
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
                actorType: 'user',
                workspaceId: null,
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

        it('user.activated → the account gained a credential, distinct from the sign-in', () => {
            // `accept-invite.use-case.ts` appends `user.activated` and
            // `auth.signed_in` together. Only the sign-in was mapped, so the
            // trail said an invited person signed in and never that the account
            // went `pending` → `active`. Verified live under ORT-42: two
            // dispatched outbox rows, one audit row.
            const row = toAuditRow(
                event(
                    'user.activated',
                    'user',
                    TARGET_USER_ID,
                    {},
                    { id: TARGET_USER_ID, email: 'invited@example.com' }
                )
            );
            expect(row).toEqual({
                id: EVENT_ID,
                kind: 'user.activated',
                subjectType: 'user',
                subjectId: TARGET_USER_ID,
                actorId: TARGET_USER_ID,
                actorType: 'user',
                workspaceId: null,
                actorEmail: 'invited@example.com',
                meta: null,
                at: AT
            });
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
                actorType: 'user',
                workspaceId: null,
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
                actorType: 'user',
                workspaceId: null,
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

    describe('media library (event kind === audit kind)', () => {
        const ASSET_ID = '44444444-4444-4444-8444-444444444444';
        const FOLDER_ID = '55555555-5555-4555-8555-555555555555';

        it('media.asset.uploaded → media_asset subject, payload minus actor', () => {
            const row = toAuditRow(
                event('media.asset.uploaded', 'media.asset', ASSET_ID, {
                    name: 'hero.png',
                    kind: 'image',
                    folderId: null
                })
            );
            expect(row).toEqual({
                ...base(),
                kind: 'media.asset.uploaded',
                subjectType: 'media_asset',
                subjectId: ASSET_ID,
                meta: { name: 'hero.png', kind: 'image', folderId: null }
            });
        });

        it('media.asset.updated carries only the field that changed', () => {
            expect(
                toAuditRow(
                    event('media.asset.updated', 'media.asset', ASSET_ID, {
                        alt: 'A hero image'
                    })
                )
            ).toMatchObject({
                kind: 'media.asset.updated',
                subjectType: 'media_asset',
                subjectId: ASSET_ID,
                meta: { alt: 'A hero image' }
            });
        });

        it('media.asset.moved records the destination folder', () => {
            expect(
                toAuditRow(
                    event('media.asset.moved', 'media.asset', ASSET_ID, {
                        folderId: FOLDER_ID
                    })
                )
            ).toMatchObject({
                kind: 'media.asset.moved',
                subjectId: ASSET_ID,
                meta: { folderId: FOLDER_ID }
            });
        });

        it('media.asset.deleted keeps the storage key — the blob-GC seam', () => {
            expect(
                toAuditRow(
                    event('media.asset.deleted', 'media.asset', ASSET_ID, {
                        storageKey: 'ws/asset/hero.png',
                        storageProvider: 'local'
                    })
                )
            ).toMatchObject({
                kind: 'media.asset.deleted',
                subjectType: 'media_asset',
                meta: {
                    storageKey: 'ws/asset/hero.png',
                    storageProvider: 'local'
                }
            });
        });

        it('media.folder.created → media_folder subject', () => {
            expect(
                toAuditRow(
                    event('media.folder.created', 'media.folder', FOLDER_ID, {
                        name: 'Campaign',
                        parentId: null
                    })
                )
            ).toEqual({
                ...base(),
                kind: 'media.folder.created',
                subjectType: 'media_folder',
                subjectId: FOLDER_ID,
                meta: { name: 'Campaign', parentId: null }
            });
        });

        it('media.folder.renamed → media_folder subject, { name }', () => {
            expect(
                toAuditRow(
                    event('media.folder.renamed', 'media.folder', FOLDER_ID, {
                        name: 'Campaign 2026'
                    })
                )
            ).toMatchObject({
                kind: 'media.folder.renamed',
                subjectType: 'media_folder',
                meta: { name: 'Campaign 2026' }
            });
        });

        it('media.folder.deleted → media_folder subject, empty meta', () => {
            expect(
                toAuditRow(
                    event('media.folder.deleted', 'media.folder', FOLDER_ID, {})
                )
            ).toMatchObject({
                kind: 'media.folder.deleted',
                subjectType: 'media_folder',
                subjectId: FOLDER_ID,
                meta: {}
            });
        });

        it('never repeats the actor inside meta — it owns two columns already', () => {
            const row = toAuditRow(
                event('media.asset.uploaded', 'media.asset', ASSET_ID, {
                    name: 'hero.png'
                })
            );
            expect(row?.meta).not.toHaveProperty('actor');
            expect(row?.actorId).toBe(ACTOR.id);
            expect(row?.actorEmail).toBe(ACTOR.email);
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

        /**
         * The whole-catalogue check. An event kind with no mapper is not an
         * error anywhere at runtime — the dispatcher finds no subscriber,
         * stamps the row dispatched, and the action is silently unaudited. This
         * list is the only place that omission is visible, so it is pinned
         * exhaustively rather than sampled.
         */
        it('audits exactly the 61 expected kinds', () => {
            expect([...AUDITED_EVENT_KINDS].sort()).toEqual(
                [
                    'alarm.rule.created',
                    'alarm.rule.deleted',
                    'alarm.rule.rescanned',
                    'alarm.rule.updated',
                    'api_token.created',
                    'api_token.revoked',
                    'api_token.used',
                    'auth.sign_in_failed',
                    'auth.signed_in',
                    'auth.signed_out',
                    'copilot.skill.created',
                    'copilot.skill.deleted',
                    'copilot.skill.updated',
                    'copilot.tool_permission.decided',
                    'media.asset.deleted',
                    'media.asset.moved',
                    'media.asset.updated',
                    'media.asset.uploaded',
                    'media.folder.created',
                    'media.folder.deleted',
                    'media.folder.renamed',
                    'saved_view.created',
                    'saved_view.deleted',
                    'saved_view.updated',
                    'segment.created',
                    'segment.deleted',
                    'segment.entry_access_changed',
                    'segment.updated',
                    'transfer.content.exported',
                    'transfer.content.imported',
                    'user.activated',
                    'user.disabled',
                    'user.enabled',
                    'user.password_changed',
                    'user.session_revoked',
                    'user.sso_linked',
                    'user.sso_provisioned',
                    'user.sso_role_mapped',
                    'entry.created',
                    'entry.deleted',
                    'entry.published',
                    'entry.purged',
                    'entry.restored',
                    'entry.unpublished',
                    'entry.updated',
                    'member.disabled',
                    'member.invite_resent',
                    'member.invited',
                    'member.password_reset_issued',
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
