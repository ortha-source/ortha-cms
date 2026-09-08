import { ProtectionRulesService } from './protection-rules.service';
import { UnknownProtectedContentTypeError } from '../domain/errors';
import type { SaveProtectionRuleDto } from './dto/save-protection-rule.dto';

const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const ACTOR = '55555555-5555-4555-8555-555555555555';

/** A `UnitOfWork` that just runs the callback — there is no transaction to fake. */
const uow = { run: <T>(fn: () => Promise<T> | T) => Promise.resolve(fn()) };

/** Records what the repository was asked to store. */
function repository() {
    const saved: unknown[] = [];
    return {
        saved,
        repo: {
            save: async (
                workspaceId: string,
                kind: string,
                slug: string,
                input: unknown
            ) => {
                saved.push({ workspaceId, kind, slug, input });
                return { id: 'rule-1' };
            },
            remove: async () => true,
            list: async () => [],
            find: async () => null
        }
    };
}

/** A registry holding one collection and one page. */
const registry = {
    get: (slug: string) =>
        slug === 'article'
            ? { name: 'article', kind: 'collection' }
            : slug === 'landing'
              ? { name: 'landing', kind: 'single' }
              : undefined
};

/** Grants naming `slugs`. */
const grants = (...slugs: string[]) => ({
    grantedSlugs: async () => new Set(slugs)
});

/** The service, wired to the fakes above. */
function service(
    repo: unknown,
    granted: string[] = ['article', 'landing']
): ProtectionRulesService {
    return new ProtectionRulesService(
        uow as never,
        repo as never,
        grants(...granted) as never,
        registry as never
    );
}

describe('ProtectionRulesService.save', () => {
    /**
     * The default set is the design document's table, and it is chosen so that
     * `{ enabled: true }` and nothing else is the safest useful rule.
     */
    it('fills every unstated field with its documented default', async () => {
        const { repo, saved } = repository();

        await service(repo).save(
            WORKSPACE,
            'collection',
            'article',
            {} as SaveProtectionRuleDto,
            ACTOR
        );

        expect(saved).toEqual([
            {
                workspaceId: WORKSPACE,
                kind: 'collection',
                slug: 'article',
                input: {
                    enabled: false,
                    requiredApprovals: 1,
                    requireOtherPerson: true,
                    countStaleApprovals: false,
                    adminBypass: true,
                    allowTokenPublish: false,
                    updatedBy: ACTOR
                }
            }
        ]);
    });

    it('takes the stated fields over the defaults', async () => {
        const { repo, saved } = repository();

        await service(repo).save(
            WORKSPACE,
            'collection',
            'article',
            {
                enabled: true,
                requiredApprovals: 3,
                adminBypass: false
            } as SaveProtectionRuleDto,
            ACTOR
        );

        expect((saved[0] as { input: Record<string, unknown> }).input).toEqual({
            enabled: true,
            requiredApprovals: 3,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: false,
            allowTokenPublish: false,
            updatedBy: ACTOR
        });
    });

    /**
     * `class-transformer` materialises an omitted optional as an explicit
     * `undefined`, which spread straight over the defaults would overwrite one
     * with nothing and store a null — turning "omitted means default" into
     * "omitted means broken" for exactly the fields nobody sent.
     */
    it('does not let an explicit undefined erase a default', async () => {
        const { repo, saved } = repository();

        await service(repo).save(
            WORKSPACE,
            'collection',
            'article',
            {
                enabled: true,
                adminBypass: undefined,
                requiredApprovals: undefined
            } as SaveProtectionRuleDto,
            ACTOR
        );

        expect((saved[0] as { input: Record<string, unknown> }).input).toEqual({
            enabled: true,
            requiredApprovals: 1,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: true,
            allowTokenPublish: false,
            updatedBy: ACTOR
        });
    });

    it('records nobody when there is no acting user', async () => {
        const { repo, saved } = repository();

        await service(repo).save(
            WORKSPACE,
            'collection',
            'article',
            {} as SaveProtectionRuleDto,
            null
        );

        expect(
            (saved[0] as { input: { updatedBy: string | null } }).input
                .updatedBy
        ).toBeNull();
    });

    describe('the type has to be one the workspace can reach', () => {
        it('refuses a type that is not registered', async () => {
            const { repo, saved } = repository();

            await expect(
                service(repo).save(
                    WORKSPACE,
                    'collection',
                    'nope',
                    {} as SaveProtectionRuleDto,
                    ACTOR
                )
            ).rejects.toBeInstanceOf(UnknownProtectedContentTypeError);
            expect(saved).toEqual([]);
        });

        it('refuses a registered type addressed as the wrong kind', async () => {
            const { repo, saved } = repository();

            // `article` is a collection; `single/article` is a different
            // coordinate and names nothing.
            await expect(
                service(repo).save(
                    WORKSPACE,
                    'single',
                    'article',
                    {} as SaveProtectionRuleDto,
                    ACTOR
                )
            ).rejects.toBeInstanceOf(UnknownProtectedContentTypeError);
            expect(saved).toEqual([]);
        });

        it('refuses a registered type the workspace was not granted', async () => {
            const { repo, saved } = repository();

            await expect(
                service(repo, ['landing']).save(
                    WORKSPACE,
                    'collection',
                    'article',
                    {} as SaveProtectionRuleDto,
                    ACTOR
                )
            ).rejects.toBeInstanceOf(UnknownProtectedContentTypeError);
            expect(saved).toEqual([]);
        });

        /**
         * The same error for all three causes, which is content's own rule:
         * telling "no such type" apart from "not yours" turns the settings tab
         * into a way to enumerate the deployment's content model.
         */
        it('says the same thing however it failed', async () => {
            const { repo } = repository();
            const messages: string[] = [];

            for (const [kind, slug, granted] of [
                ['collection', 'nope', ['article']],
                ['single', 'article', ['article']],
                ['collection', 'article', ['landing']]
            ] as const) {
                await service(repo, [...granted])
                    .save(
                        WORKSPACE,
                        kind,
                        slug,
                        {} as SaveProtectionRuleDto,
                        ACTOR
                    )
                    .catch((error: Error) =>
                        messages.push(error.message.replace(slug, '<slug>'))
                    );
            }

            // Same sentence shape every time; only the coordinate echoed back
            // differs, and the caller supplied that.
            expect(
                new Set(messages.map((m) => m.replace(/"[^"]*"/, '"x"')))
            ).toHaveProperty('size', 1);
        });

        it('accepts a page addressed as a page', async () => {
            const { repo, saved } = repository();

            await service(repo).save(
                WORKSPACE,
                'single',
                'landing',
                {} as SaveProtectionRuleDto,
                ACTOR
            );

            expect(saved).toHaveLength(1);
        });
    });
});

describe('ProtectionRulesService.remove', () => {
    /**
     * Removing protection always succeeds. A rule stranded by a revoked grant
     * is precisely the row an administrator is trying to clear, and refusing it
     * would leave one nothing in the product could reach.
     */
    it('does not check the grant', async () => {
        const { repo } = repository();

        await expect(
            service(repo, []).remove(WORKSPACE, 'collection', 'article')
        ).resolves.toBe(true);
    });

    it('does not check that the type is registered either', async () => {
        const { repo } = repository();

        await expect(
            service(repo).remove(WORKSPACE, 'collection', 'long_gone')
        ).resolves.toBe(true);
    });
});

describe('ProtectionRulesService.list', () => {
    /**
     * Including rules on types the workspace can no longer reach: filtering
     * them out would leave a row the product could neither show nor delete.
     */
    it('does not filter by the current grants', async () => {
        const rows = [{ id: 'r1', slug: 'ungranted' }];
        const repo = { list: async () => rows };

        await expect(service(repo, []).list(WORKSPACE)).resolves.toBe(rows);
    });
});
