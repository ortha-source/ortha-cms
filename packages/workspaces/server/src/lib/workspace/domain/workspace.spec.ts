import { Workspace } from './workspace';
import { Slug } from './value-objects/slug';
import { WorkspaceColor } from './value-objects/workspace-color';
import { WorkspaceStatus } from './value-objects/workspace-status';
import {
    ContentTypeNotEmptyError,
    LastMemberError,
    WorkspaceNotEmptyError
} from './errors';
import { WORKSPACE_EVENT_KINDS } from './events/workspace-events';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const CREATOR = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const UNKNOWN = '44444444-4444-4444-8444-444444444444';

/** A loaded workspace with one member and one collection grant. */
function rehydrated(): Workspace {
    return Workspace.rehydrate({
        id: WORKSPACE_ID,
        name: 'Marketing',
        slug: 'marketing',
        description: 'The marketing team',
        color: 'slate',
        status: 'active',
        memberUserIds: [CREATOR],
        grants: [{ kind: 'collection', slug: 'blog_post' }]
    });
}

describe('Workspace aggregate', () => {
    describe('create', () => {
        it('links the creator as the first member and raises workspace.created', () => {
            const workspace = Workspace.create({
                name: 'Marketing',
                slug: Slug.create('marketing'),
                description: '',
                color: WorkspaceColor.default(),
                creatorUserId: CREATOR,
                memberUserIds: [OTHER],
                grants: [{ kind: 'single', slug: 'home' }]
            });

            const changes = workspace.changes();
            expect(changes.isNew).toBe(true);
            expect(changes.addedMemberIds).toEqual([CREATOR, OTHER]);
            expect(changes.addedGrants).toEqual([
                { kind: 'single', slug: 'home' }
            ]);

            const events = workspace.pullEvents();
            expect(events.map((event) => event.kind)).toEqual([
                WORKSPACE_EVENT_KINDS.CREATED
            ]);
            expect(events[0].aggregateId).toBe(workspace.id.value);
        });

        it('dedupes a member that repeats the creator', () => {
            const workspace = Workspace.create({
                name: 'Marketing',
                slug: Slug.create('marketing'),
                description: '',
                color: WorkspaceColor.default(),
                creatorUserId: CREATOR,
                memberUserIds: [CREATOR],
                grants: []
            });
            expect(workspace.changes().addedMemberIds).toEqual([CREATOR]);
        });
    });

    describe('updateProfile', () => {
        it('is a no-op for an empty patch (records nothing)', () => {
            const workspace = rehydrated();
            expect(workspace.updateProfile({})).toBe(false);
            expect(workspace.pullEvents()).toHaveLength(0);
            expect(workspace.changes().profileChanged).toBe(false);
        });

        it('applies present fields and raises workspace.updated with the field names', () => {
            const workspace = rehydrated();
            expect(workspace.updateProfile({ name: 'Growth' })).toBe(true);
            expect(workspace.name).toBe('Growth');
            const [event] = workspace.pullEvents();
            expect(event.kind).toBe(WORKSPACE_EVENT_KINDS.UPDATED);
            expect(event.payload).toEqual({ fields: ['name'] });
        });
    });

    describe('setStatus', () => {
        it('is a no-op when the status already matches', () => {
            const workspace = rehydrated();
            expect(workspace.setStatus(WorkspaceStatus.active())).toBe(false);
            expect(workspace.pullEvents()).toHaveLength(0);
        });

        it('archives and raises workspace.archived', () => {
            const workspace = rehydrated();
            expect(workspace.setStatus(WorkspaceStatus.archived())).toBe(true);
            expect(workspace.pullEvents()[0].kind).toBe(
                WORKSPACE_EVENT_KINDS.ARCHIVED
            );
        });
    });

    describe('membership', () => {
        it('adds a new member once (idempotent)', () => {
            const workspace = rehydrated();
            expect(workspace.addMember(OTHER)).toBe(true);
            expect(workspace.addMember(OTHER)).toBe(false);
            expect(workspace.changes().addedMemberIds).toEqual([OTHER]);
        });

        it('removes a member, and removing a non-member is a no-op', () => {
            const workspace = rehydrated();
            workspace.addMember(OTHER);
            expect(workspace.removeMember(UNKNOWN)).toBe(false);
            expect(workspace.removeMember(CREATOR)).toBe(true);
            expect(workspace.changes().removedMemberIds).toEqual([CREATOR]);
        });

        it('refuses to remove the last member (no-memberless-workspace)', () => {
            const workspace = rehydrated();

            // Access is membership-scoped, so a workspace with no members is
            // unreachable by everyone — including a global admin — with no
            // route left to recover or even delete it.
            expect(() => workspace.removeMember(CREATOR)).toThrow(
                LastMemberError
            );
            expect(workspace.changes().removedMemberIds).toEqual([]);
        });
    });

    describe('content grants', () => {
        it('grants a new type once (idempotent)', () => {
            const workspace = rehydrated();
            expect(workspace.grantContent('single', 'home')).toBe(true);
            expect(workspace.grantContent('single', 'home')).toBe(false);
            expect(workspace.grantContent('collection', 'blog_post')).toBe(
                false
            );
        });

        it('revokes only when the type is empty (no-orphaned-content)', () => {
            const workspace = rehydrated();
            expect(() => workspace.revokeContent('blog_post', 3)).toThrow(
                ContentTypeNotEmptyError
            );
            expect(workspace.revokeContent('blog_post', 0)).toBe(true);
            expect(workspace.changes().removedGrantSlugs).toEqual([
                'blog_post'
            ]);
        });

        it('revoking a grant the workspace never held is a no-op', () => {
            const workspace = rehydrated();
            expect(workspace.revokeContent('product', 0)).toBe(false);
        });
    });

    describe('assertDeletable (no-orphaned-content)', () => {
        it('throws while the workspace still holds entries', () => {
            const workspace = rehydrated();
            expect(() => workspace.assertDeletable(2)).toThrow(
                WorkspaceNotEmptyError
            );
        });

        it('raises workspace.deleted when empty', () => {
            const workspace = rehydrated();
            workspace.assertDeletable(0);
            expect(workspace.pullEvents()[0].kind).toBe(
                WORKSPACE_EVENT_KINDS.DELETED
            );
        });
    });
});
