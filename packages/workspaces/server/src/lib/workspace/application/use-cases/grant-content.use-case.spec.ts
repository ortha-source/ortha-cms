import type { OutboxWriter, UnitOfWork, DomainEvent } from '@orthacms/database';
import type { PublicUser } from '@orthacms/identity-server';
import { GrantContentUseCase } from './grant-content.use-case';
import { ContentCatalogReader } from '../content/content-catalog.reader';
import { Workspace } from '../../domain/workspace';
import type { WorkspaceRepository } from '../../domain/workspace.repository';
import { WORKSPACE_EVENT_KINDS } from '../../domain/events/workspace-events';
import {
    InvalidSharedSourceError,
    UnknownContentTypeError,
    WorkspaceNotFoundError
} from '../../domain/errors';
import type { SharedContentSources } from '../ports/shared-content-sources.port';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
/** A shared, active workspace that holds its own `author` grant. */
const LIBRARY = '33333333-3333-4333-8333-333333333333';

const ACTOR = {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'grace@example.com'
} as PublicUser;

/** A loaded workspace already holding `blog_post`. */
function rehydrated(): Workspace {
    return Workspace.rehydrate({
        id: WORKSPACE_ID,
        name: 'Marketing',
        slug: 'marketing',
        description: '',
        color: 'slate',
        status: 'active',
        isShared: false,
        memberUserIds: [MEMBER],
        grants: [{ kind: 'collection', slug: 'blog_post' }]
    });
}

/** The use case wired to fakes appending to one ordered `log`. */
function harness(options: { workspace?: Workspace | null } = {}) {
    const log: string[] = [];
    const appended: DomainEvent[] = [];
    const workspace =
        options.workspace === undefined ? rehydrated() : options.workspace;

    const catalog = new ContentCatalogReader({
        list: () => [
            { name: 'blog_post', kind: 'collection' },
            { name: 'author', kind: 'collection' },
            { name: 'home', kind: 'single' }
        ]
    });

    const workspaces = {
        findById: async () => {
            log.push('load:unlocked');
            return workspace;
        },
        findByIdForContentMutation: async () => {
            log.push('load:locked');
            return workspace;
        },
        save: async () => {
            log.push('save');
        },
        delete: async () => {
            log.push('delete');
        },
        existsBySlug: async () => false
    } as WorkspaceRepository;

    const uow = {
        run: async <T>(fn: () => Promise<T>): Promise<T> => {
            log.push('run:start');
            const result = await fn();
            log.push('run:end');
            return result;
        }
    } as unknown as UnitOfWork;

    const outbox = {
        append: async (events: DomainEvent[]) => {
            log.push('append');
            appended.push(...events);
        }
    } as unknown as OutboxWriter;

    const sources = {
        list: async () => [],
        offeredKind: async (sourceId: string, slug: string) => {
            log.push(`offered:${sourceId}:${slug}`);
            return sourceId === LIBRARY && slug === 'author'
                ? ('collection' as const)
                : null;
        }
    } as SharedContentSources;

    return {
        useCase: new GrantContentUseCase(
            uow,
            outbox,
            catalog,
            workspaces,
            sources
        ),
        workspace,
        log,
        appended
    };
}

/**
 * Granting is the non-destructive counterpart, and it is worth its own spec
 * for the two ways it differs from revoke.
 *
 * It resolves the *kind* server-side — the client sends a slug and nothing
 * else — so an unknown slug has to be refused before anything opens, or the
 * workspace ends up holding a grant row that points at no content type and
 * that nothing will ever flag. And it deliberately loads through the plain
 * reader: adding a grant orphans nothing, so making it wait on the exclusive
 * content lock would serialize it against every entry write for no benefit.
 */
describe('GrantContentUseCase', () => {
    it('grants a known type and drains workspace.content_granted with the actor', async () => {
        const { useCase, log, appended } = harness();

        await useCase.execute(ACTOR, WORKSPACE_ID, 'author');

        expect(log).toEqual([
            'run:start',
            'load:unlocked',
            'save',
            'append',
            'run:end'
        ]);
        expect(appended.map((event) => event.kind)).toEqual([
            WORKSPACE_EVENT_KINDS.CONTENT_GRANTED
        ]);
        expect(appended[0].payload).toMatchObject({
            slug: 'author',
            kind: 'collection',
            actor: { id: ACTOR.id, email: ACTOR.email }
        });
    });

    it('derives the kind from the catalogue rather than the request [workspaces:I-20]', async () => {
        const { useCase, appended } = harness();

        await useCase.execute(ACTOR, WORKSPACE_ID, 'home');

        expect(appended[0].payload).toMatchObject({ kind: 'single' });
    });

    it('rejects an unknown slug before the unit of work opens', async () => {
        // Not merely before the write — before the transaction. A grant row
        // naming no content type is unreachable and silent.
        const { useCase, log } = harness();

        await expect(
            useCase.execute(ACTOR, WORKSPACE_ID, 'ghost_type')
        ).rejects.toThrow(UnknownContentTypeError);

        expect(log).toEqual([]);
    });

    it('takes no content lock — adding a grant orphans nothing', async () => {
        const { useCase, log } = harness();

        await useCase.execute(ACTOR, WORKSPACE_ID, 'author');

        expect(log).toContain('load:unlocked');
        expect(log).not.toContain('load:locked');
    });

    it('is a silent no-op when the grant is already held', async () => {
        const { useCase, log, appended } = harness();

        await expect(
            useCase.execute(ACTOR, WORKSPACE_ID, 'blog_post')
        ).resolves.toBeUndefined();

        expect(log).not.toContain('save');
        expect(appended).toEqual([]);
    });

    it('404s an unknown workspace', async () => {
        const { useCase, appended } = harness({ workspace: null });

        await expect(
            useCase.execute(ACTOR, WORKSPACE_ID, 'author')
        ).rejects.toThrow(WorkspaceNotFoundError);

        expect(appended).toEqual([]);
    });

    it('rejects a malformed id before resolving the slug', async () => {
        const { useCase, log } = harness();

        await expect(
            useCase.execute(ACTOR, 'not-a-uuid', 'author')
        ).rejects.toThrow();

        expect(log).toEqual([]);
    });

    describe('a shared grant (ADR-0019, explicit per-source grants)', () => {
        it('grants an eligible source and carries it on the event', async () => {
            const { useCase, workspace, appended } = harness();

            await useCase.execute(ACTOR, WORKSPACE_ID, 'author', LIBRARY);

            expect(workspace?.changes().addedGrants).toEqual([
                {
                    kind: 'collection',
                    slug: 'author',
                    sourceWorkspaceId: LIBRARY
                }
            ]);
            expect(appended[0].payload).toMatchObject({
                slug: 'author',
                sourceWorkspaceId: LIBRARY
            });
        });

        it('is independent of the own grant of the same slug', async () => {
            const { useCase, workspace } = harness();

            await useCase.execute(ACTOR, WORKSPACE_ID, 'author');
            await useCase.execute(ACTOR, WORKSPACE_ID, 'author', LIBRARY);

            expect(workspace?.changes().addedGrants).toEqual([
                { kind: 'collection', slug: 'author' },
                {
                    kind: 'collection',
                    slug: 'author',
                    sourceWorkspaceId: LIBRARY
                }
            ]);
        });

        it('refuses a source that does not offer the slug', async () => {
            const { useCase, log } = harness();

            await expect(
                useCase.execute(ACTOR, WORKSPACE_ID, 'blog_post', LIBRARY)
            ).rejects.toThrow(InvalidSharedSourceError);

            expect(log).not.toContain('save');
        });

        it('refuses the workspace itself as a source without asking', async () => {
            const { useCase, log } = harness();

            await expect(
                useCase.execute(ACTOR, WORKSPACE_ID, 'author', WORKSPACE_ID)
            ).rejects.toThrow(InvalidSharedSourceError);

            expect(log.some((entry) => entry.startsWith('offered:'))).toBe(
                false
            );
        });
    });
});
