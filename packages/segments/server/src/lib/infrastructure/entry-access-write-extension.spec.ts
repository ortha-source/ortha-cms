import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type {
    EntryWriteExtensionInput,
    EntryWriteExtensionTarget
} from '@orthacms/content-server';
import { sameAccess, type EntryAccess } from '@orthacms/segments-domain';
import { EntryAccessWriteExtension } from './entry-access-write-extension';

/** The type only ever supplies its `name` here. */
const TYPE = { name: 'article' } as EntryWriteExtensionTarget['type'];

/**
 * A stand-in access service over one in-memory row.
 *
 * `groupHas` / `setForGroup` rather than `get` / `set`, because the extension
 * asks about the entry's whole **locale group** — a save that matches the
 * English article but not the German one still has work to do. The group's
 * membership is the service's business and is exercised end-to-end; what this
 * spec is about is the permission gate around the write.
 */
function accessService(stored: EntryAccess = { allow: [], deny: [] }) {
    return {
        current: stored,
        writes: 0,
        async get() {
            return this.current;
        },
        async groupHas(
            _workspaceId: string,
            _type: unknown,
            _entryId: string,
            wanted: EntryAccess
        ) {
            return sameAccess(this.current, wanted);
        },
        async setForGroup(input: { allow: string[]; deny: string[] }) {
            this.writes += 1;
            this.current = { allow: input.allow, deny: input.deny };
            return this.current;
        }
    };
}

/** A stand-in principal + permissions pair for one role's grants. */
function actor(granted: string[] | null) {
    return {
        principal: { current: () => (granted ? { roleId: 'r' } : undefined) },
        permissions: { forRole: async () => granted ?? [] }
    };
}

/** Builds the extension over the two stand-ins. */
function build(
    access: ReturnType<typeof accessService>,
    granted: string[] | null
) {
    const { principal, permissions } = actor(granted);
    return new EntryAccessWriteExtension(
        access as never,
        principal as never,
        permissions as never
    );
}

/** One `apply` call over a payload. */
function input(value: unknown): EntryWriteExtensionInput {
    return {
        executor: {} as EntryWriteExtensionInput['executor'],
        type: TYPE,
        entryId: 'e1',
        workspaceId: 'w1',
        value
    };
}

const MANAGE = ['segments:manage'];

describe('EntryAccessWriteExtension', () => {
    describe('apply', () => {
        it('writes the audiences the save carried', async () => {
            const access = accessService();
            await build(access, MANAGE).apply(
                input({ allow: ['s1'], deny: [] })
            );

            expect(access.current).toEqual({ allow: ['s1'], deny: [] });
        });

        it('refuses a caller who may edit the record but not decide who reads it', async () => {
            // The escalation this gate exists for: the save it rides asked only
            // for `content:update`, so without this a contributor could restrict
            // any entry they can edit by naming the key in the body.
            const access = accessService();
            const extension = build(access, ['content:update']);

            await expect(
                extension.apply(input({ allow: ['s1'], deny: [] }))
            ).rejects.toBeInstanceOf(ForbiddenException);
            expect(access.writes).toBe(0);
        });

        it('refuses a caller it cannot identify', async () => {
            // A path the principal middleware did not cover cannot be shown to
            // hold the permission, so it does not.
            const extension = build(accessService(), null);

            await expect(
                extension.apply(input({ allow: ['s1'], deny: [] }))
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('needs no permission to re-assert what is already stored', async () => {
            // What keeps **restore** working for anyone who may restore: putting
            // back a version whose audiences match today's is not a decision
            // about access. Order is ignored, so a reordered list is still a
            // no-op.
            const access = accessService({ allow: ['s2', 's1'], deny: [] });
            const extension = build(access, ['content:update']);

            await extension.apply(input({ allow: ['s1', 's2'], deny: [] }));

            expect(access.writes).toBe(0);
        });

        it('refuses a restore that would change who can read the entry', async () => {
            const access = accessService({ allow: ['s1'], deny: [] });
            const extension = build(access, ['content:update']);

            await expect(
                extension.apply(input({ allow: [], deny: [] }))
            ).rejects.toBeInstanceOf(ForbiddenException);
        });

        it('rejects a malformed payload before anything is written', async () => {
            const access = accessService();
            const extension = build(access, MANAGE);

            await expect(extension.apply(input('nope'))).rejects.toBeInstanceOf(
                BadRequestException
            );
            await expect(
                extension.apply(input({ allow: [1], deny: [] }))
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(access.writes).toBe(0);
        });

        it('reads a missing list as empty rather than refusing it', async () => {
            const access = accessService({ allow: ['s1'], deny: [] });
            await build(access, MANAGE).apply(input({ deny: ['s2'] }));

            expect(access.current).toEqual({ allow: [], deny: ['s2'] });
        });
    });

    describe('capture', () => {
        const target: EntryWriteExtensionTarget = {
            executor: {} as EntryWriteExtensionTarget['executor'],
            type: TYPE,
            entryId: 'e1',
            workspaceId: 'w1'
        };

        it('records the entry’s audiences', async () => {
            const access = accessService({ allow: ['s1'], deny: ['s2'] });

            await expect(
                build(access, MANAGE).capture(target)
            ).resolves.toEqual({
                allow: ['s1'],
                deny: ['s2']
            });
        });

        it('records nothing for an unrestricted entry', async () => {
            // So a snapshot of ordinary open content stays byte-for-byte what it
            // was before this extension existed.
            await expect(
                build(accessService(), MANAGE).capture(target)
            ).resolves.toBeUndefined();
        });
    });
});
