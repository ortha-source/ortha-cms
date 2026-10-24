import type { ActivityEvent } from '../../types/activityEvent';
import { activityDiff, humanizeKey } from './index';

/** An event carrying the given meta. */
function withMeta(
    kind: string,
    meta: Record<string, unknown> | null
): ActivityEvent {
    return {
        id: 'ev_1',
        kind: kind as ActivityEvent['kind'],
        subjectType: 'user',
        subjectId: 'u_1',
        subjectLabel: null,
        actor: null,
        meta,
        workspaceId: null,
        at: new Date()
    };
}

describe('the event panel’s before/after', () => {
    it('reads a role change’s bare { from, to } as the Role row', () => {
        expect(
            activityDiff(
                withMeta('user.role_changed', {
                    from: 'contributor',
                    to: 'admin'
                })
            )
        ).toEqual([{ key: 'role', before: 'contributor', after: 'admin' }]);
    });

    it('reads every per-field { from, to } in meta order', () => {
        expect(
            activityDiff(
                withMeta('segment.updated', {
                    key: 'members',
                    tags: { from: ['a'], to: ['a', 'b'] },
                    enabled: { from: true, to: false }
                })
            )
        ).toEqual([
            { key: 'tags', before: ['a'], after: ['a', 'b'] },
            { key: 'enabled', before: true, after: false }
        ]);
    });

    it('keeps a one-sided transition — a value that appeared or went away', () => {
        expect(
            activityDiff(
                withMeta('user.profile_updated', { name: { to: 'Ada' } })
            )
        ).toEqual([{ key: 'name', before: undefined, after: 'Ada' }]);
    });

    it('invents nothing for a kind that recorded no transition', () => {
        expect(
            activityDiff(
                withMeta('entry.updated', {
                    contentType: 'article',
                    fields: ['title', 'body']
                })
            )
        ).toEqual([]);
        expect(activityDiff(withMeta('user.signed_in', null))).toEqual([]);
    });

    it('never reads `via` — how an action was done — as a change', () => {
        expect(
            activityDiff(
                withMeta('entry.updated', {
                    via: { kind: 'copilot', from: 'x', to: 'y' }
                })
            )
        ).toEqual([]);
    });

    it('humanizes a key it has no label for', () => {
        expect(humanizeKey('sessionsRevoked')).toBe('Sessions revoked');
        expect(humanizeKey('content_type')).toBe('Content type');
        expect(humanizeKey('visibility')).toBe('Visibility');
    });
});
