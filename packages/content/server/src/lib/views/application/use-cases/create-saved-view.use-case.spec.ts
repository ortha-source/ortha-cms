import type { PublicUser } from '@orthacms/identity-server';
import { SavedViewLimitError } from '../../domain/errors';
import { VIEW_MAX_PER_SCOPE } from '../../views.constants';
import { CreateSavedViewUseCase } from './create-saved-view.use-case';

/**
 * The per-person cap has no constraint behind it, so it holds only if the
 * count and the insert are serialised. Counting outside the transaction let
 * two concurrent saves at 99 both see room for one more and both commit —
 * which is why the order of calls, and whether each ran inside the unit of
 * work, is what this asserts.
 */
describe('CreateSavedViewUseCase and the per-person cap', () => {
    const user = { id: 'user-1', email: 'u@example.com' } as PublicUser;
    const input = {
        workspaceId: 'ws-1',
        scope: 'content:article',
        name: 'Mine',
        visibility: 'private' as const,
        payload: {} as never
    };

    function build(held: number) {
        const calls: string[] = [];
        let inTransaction = false;
        const record = (name: string) =>
            calls.push(`${name}${inTransaction ? ' (in tx)' : ''}`);
        const repository = {
            lockOwner: jest.fn(async () => record('lock')),
            countForOwner: jest.fn(async () => {
                record('count');
                return held;
            }),
            create: jest.fn(async () => {
                record('create');
                return {
                    id: 'view-1',
                    ...input,
                    ownerId: user.id,
                    position: 0,
                    updatedAt: new Date()
                };
            })
        };
        const uow = {
            run: async <T>(work: () => Promise<T>) => {
                inTransaction = true;
                try {
                    return await work();
                } finally {
                    inTransaction = false;
                }
            }
        };
        const useCase = new CreateSavedViewUseCase(
            repository as never,
            { assertCanUseVisibility: async () => undefined } as never,
            uow as never,
            { append: async () => undefined } as never
        );
        return { useCase, repository, calls };
    }

    it('locks the owner, then counts, then inserts — all in one transaction', async () => {
        const { useCase, repository, calls } = build(VIEW_MAX_PER_SCOPE - 1);

        await useCase.execute(input, user);

        expect(calls).toEqual([
            'lock (in tx)',
            'count (in tx)',
            'create (in tx)'
        ]);
        expect(repository.lockOwner).toHaveBeenCalledWith(
            input.workspaceId,
            input.scope,
            user.id
        );
    });

    it('refuses at the ceiling without inserting', async () => {
        const { useCase, repository } = build(VIEW_MAX_PER_SCOPE);

        await expect(useCase.execute(input, user)).rejects.toBeInstanceOf(
            SavedViewLimitError
        );
        expect(repository.create).not.toHaveBeenCalled();
    });
});
