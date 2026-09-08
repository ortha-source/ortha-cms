import { ProtectionRulesService } from './protection-rules.service';
import { UnknownProtectedContentTypeError } from '../domain/errors';
import type { SaveProtectionRuleDto } from './dto/save-protection-rule.dto';

const WORKSPACE = '44444444-4444-4444-8444-444444444444';
const ACTOR = '55555555-5555-4555-8555-555555555555';
/** The acting administrator, as the event stamps them. */
const ACTOR_EVENT = { id: ACTOR, email: 'admin@example.com' };

/** A `UnitOfWork` that just runs the callback — there is no transaction to fake. */
const uow = { run: <T>(fn: () => Promise<T> | T) => Promise.resolve(fn()) };

/** Records what the repository was asked to store. */
function repository() {
    const saved: unknown[] = [];
    return {
        saved,
        repo: {
            // Echoes the input back, as the real repository does with
            // `.returning()`. A fake that dropped it would let an event
            // carrying `undefined` for every field pass as correct.
            save: async (
                workspaceId: string,
                kind: string,
                slug: string,
                input: Record<string, unknown>
            ) => {
                saved.push({ workspaceId, kind, slug, input });
                return { id: 'rule-1', kind, slug, ...input };
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

/**
 * An outbox that records what was appended, so the rule-change event can be
 * asserted without a database. `protection:I-14` is about a row existing at all,
 * so "nothing was appended" has to be a visible failure rather than a silence.
 */
function outbox() {
    const appended: { kind: string; payload: Record<string, unknown> }[] = [];
    return {
        appended,
        writer: {
            append: async (
                events: { kind: string; payload: Record<string, unknown> }[]
            ) => {
                appended.push(...events);
            }
        }
    };
}

/** The service, wired to the fakes above. */
function service(
    repo: unknown,
    granted: string[] = ['article', 'landing'],
    writer: unknown = outbox().writer
): ProtectionRulesService {
    return new ProtectionRulesService(
        uow as never,
        writer as never,
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
            ACTOR_EVENT
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
            ACTOR_EVENT
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
            ACTOR_EVENT
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
            undefined
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
                    ACTOR_EVENT
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
                    ACTOR_EVENT
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
                    ACTOR_EVENT
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
                        ACTOR_EVENT
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
                ACTOR_EVENT
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

/**
 * `protection:I-14` — disabling a rule or lowering its count writes
 * `protection.rule_changed`.
 *
 * Without these rows the bypass is not a button somebody had to justify; it is
 * a settings tab left open for two minutes, and afterwards nothing can tell a
 * rule that was never there from one that was quietly removed.
 */
describe('the audit trail', () => {
    /** A repository holding one existing rule, so a save is an update. */
    function withExisting(rule: Record<string, unknown>) {
        const saved: unknown[] = [];
        return {
            saved,
            repo: {
                save: async (
                    workspaceId: string,
                    kind: string,
                    slug: string,
                    input: Record<string, unknown>
                ) => {
                    saved.push({ workspaceId, kind, slug, input });
                    return { id: 'rule-1', kind, slug, ...input };
                },
                remove: async () => true,
                list: async () => [],
                find: async () => ({ id: 'rule-1', ...rule })
            }
        };
    }

    it('records a rule being created, with no “from” side [protection:I-14]', async () => {
        const { repo } = repository();
        const box = outbox();

        await service(repo, undefined, box.writer).save(
            WORKSPACE,
            'collection',
            'article',
            { enabled: true, requiredApprovals: 2 } as SaveProtectionRuleDto,
            ACTOR_EVENT
        );

        expect(box.appended).toHaveLength(1);
        expect(box.appended[0].kind).toBe('protection.rule_changed');
        expect(box.appended[0].payload).toMatchObject({
            kind: 'collection',
            slug: 'article',
            action: 'created',
            from: null,
            to: { enabled: true, requiredApprovals: 2 }
        });
    });

    it('records both sides when the count is lowered [protection:I-14]', async () => {
        const { repo } = withExisting({
            enabled: true,
            requiredApprovals: 2,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: true,
            allowTokenPublish: false
        });
        const box = outbox();

        await service(repo, undefined, box.writer).save(
            WORKSPACE,
            'collection',
            'article',
            { enabled: true, requiredApprovals: 1 } as SaveProtectionRuleDto,
            ACTOR_EVENT
        );

        // Both sides, because "now requires 1" on its own does not say that
        // anything moved — which is the whole question an auditor asks.
        expect(box.appended[0].payload).toMatchObject({
            action: 'updated',
            from: { requiredApprovals: 2 },
            to: { requiredApprovals: 1 }
        });
    });

    it('records a rule being removed, carrying what it was [protection:I-14]', async () => {
        const { repo } = withExisting({
            enabled: true,
            requiredApprovals: 3,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: false,
            allowTokenPublish: false
        });
        const box = outbox();

        await service(repo, undefined, box.writer).remove(
            WORKSPACE,
            'collection',
            'article',
            ACTOR_EVENT
        );

        // After this commits there is nowhere left to look the numbers up.
        expect(box.appended[0].payload).toMatchObject({
            action: 'removed',
            from: { requiredApprovals: 3, adminBypass: false },
            to: null
        });
    });

    it('records nothing when a delete removed nothing', async () => {
        const box = outbox();
        const repo = {
            save: async () => ({ id: 'rule-1' }),
            // Nothing was there, so nothing was weakened.
            remove: async () => false,
            list: async () => [],
            find: async () => null
        };

        await service(repo, undefined, box.writer).remove(
            WORKSPACE,
            'collection',
            'article',
            ACTOR_EVENT
        );

        expect(box.appended).toEqual([]);
    });
});
