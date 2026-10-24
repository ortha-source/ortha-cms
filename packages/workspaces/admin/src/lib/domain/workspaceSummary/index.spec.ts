import { describe, expect, it } from 'vitest';
import { contentTypeCount, splitMembers } from '.';

describe('contentTypeCount', () => {
    it('counts own and shared grants, a type once', () => {
        expect(
            contentTypeCount({
                content: ['article', 'author'],
                sharedContent: [
                    {
                        slug: 'author',
                        kind: 'collection',
                        sourceWorkspaceId: 'w2',
                        sourceWorkspaceName: 'Marketing',
                        available: true
                    },
                    {
                        slug: 'tag',
                        kind: 'collection',
                        sourceWorkspaceId: 'w2',
                        sourceWorkspaceName: 'Marketing',
                        available: true
                    }
                ]
            })
        ).toBe(3);
    });
});

describe('splitMembers', () => {
    it('separates invitations from teammates', () => {
        const member = (id: string, pending: boolean) => ({
            id,
            name: id,
            email: `${id}@x.dev`,
            initials: 'XX',
            color: 'slate' as const,
            pending
        });
        const { active, pending } = splitMembers({
            members: [member('a', false), member('b', true)]
        });
        expect(active.map((m) => m.id)).toEqual(['a']);
        expect(pending.map((m) => m.id)).toEqual(['b']);
    });
});
