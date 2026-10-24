import type { ActivityEvent } from '../../types/activityEvent';
import { eventWorkspaceId, subjectHref } from './index';

/** An event with the given subject. */
function subject(overrides: Partial<ActivityEvent>): ActivityEvent {
    return {
        id: 'ev_1',
        kind: 'user.role_changed',
        subjectType: 'user',
        subjectId: 'u_1',
        subjectLabel: null,
        actor: null,
        meta: null,
        workspaceId: null,
        at: new Date(),
        ...overrides
    };
}

describe('"Open {subject}"', () => {
    it('opens a member, a workspace and the token list', () => {
        expect(subjectHref(subject({}))).toBe('/users/u_1');
        expect(
            subjectHref(
                subject({
                    kind: 'workspace.updated',
                    subjectType: 'workspace',
                    subjectId: 'w_1'
                })
            )
        ).toBe('/workspaces/w_1');
        expect(
            subjectHref(
                subject({ kind: 'token.created', subjectType: 'api_token' })
            )
        ).toBe('/api-tokens');
    });

    it('opens an entry in its workspace’s library when the row says where', () => {
        expect(
            subjectHref(
                subject({
                    kind: 'entry.published',
                    subjectType: 'content_entry',
                    subjectId: 'e_1',
                    workspaceId: 'w_1',
                    meta: { contentType: 'article' }
                })
            )
        ).toBe('/workspaces/w_1/content/article/e_1');
        // No workspace, no guess.
        expect(
            subjectHref(
                subject({
                    kind: 'entry.published',
                    subjectType: 'content_entry',
                    meta: { contentType: 'article' }
                })
            )
        ).toBeNull();
    });

    it('offers nothing for a subject the event itself removed', () => {
        expect(
            subjectHref(
                subject({
                    kind: 'entry.purged',
                    subjectType: 'content_entry',
                    workspaceId: 'w_1',
                    meta: { contentType: 'article' }
                })
            )
        ).toBeNull();
        expect(
            subjectHref(
                subject({ kind: 'workspace.deleted', subjectType: 'workspace' })
            )
        ).toBeNull();
    });

    it('offers nothing for a subject the admin has no page for', () => {
        expect(
            subjectHref(
                subject({
                    kind: 'media.asset.uploaded',
                    subjectType: 'media_asset'
                })
            )
        ).toBeNull();
    });

    it('encodes the id rather than trusting it in a path', () => {
        expect(subjectHref(subject({ subjectId: 'a/b?c' }))).toBe(
            '/users/a%2Fb%3Fc'
        );
    });

    it('reads the workspace off meta for a membership row', () => {
        expect(
            eventWorkspaceId(
                subject({
                    kind: 'workspace.member_added',
                    meta: { workspaceId: 'w_9' }
                })
            )
        ).toBe('w_9');
        expect(eventWorkspaceId(subject({ workspaceId: 'w_1' }))).toBe('w_1');
        expect(eventWorkspaceId(subject({}))).toBeNull();
    });
});
