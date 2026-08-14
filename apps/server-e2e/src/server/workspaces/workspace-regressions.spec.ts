import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    drainOutbox,
    getOutboxRows,
    suspendOutboxDispatch
} from '../../support/outbox';
import {
    apiTokenExists,
    countApiTokenGrants,
    countMediaAssets,
    countMediaFolders,
    getActivityRows,
    resetDb,
    seedActiveUser,
    seedApiTokenWorkspaceGrant,
    seedArticles,
    seedMediaAsset,
    seedMediaFolder,
    seedUser,
    type SeededUser,
    type SystemRoleKey
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';

/** A valid create-workspace body, with optional field overrides. */
function validBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        name: 'Marketing site',
        slug: 'marketing-site',
        description: 'Landing pages and the blog.',
        color: 'violet',
        members: [],
        content: { mode: 'all' },
        ...overrides
    };
}

/**
 * Regression suite for the defects the ORT-53 QA pass confirmed against a live
 * stack. Every case here fails on the pre-fix build, so it pins the behaviour
 * rather than merely describing it.
 *
 * They are grouped in one file because they share a property the feature suites
 * don't reach: each is a *failure* or *race* path — the last member, a
 * simultaneous duplicate slug, an address that isn't one, a route that answered
 * anybody who asked.
 */
describe('Workspaces regressions', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
    });

    async function loginAs(
        role: SystemRoleKey,
        email: string
    ): Promise<{ user: SeededUser; agent: ReturnType<typeof request.agent> }> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return { user, agent };
    }

    describe('removing the last member', () => {
        it('is refused, leaving the workspace reachable', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-last@example.com'
            );
            const created = await agent
                .post('/api/workspaces')
                .send(validBody())
                .expect(201);
            const id = created.body.id as string;

            // Access is membership-scoped, so removing the sole member used to
            // leave a row nobody — not even a global admin — could reach.
            await agent
                .delete(`/api/workspaces/${id}/members/${user.id}`)
                .expect(409);

            const list = await agent.get('/api/workspaces').expect(200);
            expect((list.body as { id: string }[]).map((w) => w.id)).toContain(
                id
            );
            await agent
                .patch(`/api/workspaces/${id}`)
                .send({ name: 'Still mine' })
                .expect(200);
        });

        it('still allows leaving while another member remains', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-leave@example.com'
            );
            const other = await seedUser(harness.app, {
                email: 'wsr-other@example.com',
                role: 'viewer',
                status: 'active'
            });
            const created = await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'leavable' }))
                .expect(201);
            const id = created.body.id as string;

            await agent
                .post(`/api/workspaces/${id}/members`)
                .send({ userId: other.id })
                .expect(201);
            await agent
                .delete(`/api/workspaces/${id}/members/${user.id}`)
                .expect(204);
        });
    });

    describe('concurrent creates with the same slug', () => {
        it('yields exactly one 201 and 409s the losers, never a 500', async () => {
            const { agent } = await loginAs('admin', 'wsr-race@example.com');

            // The availability pre-check is a read-then-write: every request
            // reads "free" before any of them inserts. The unique index is the
            // only real arbiter, so its rejection has to surface as the same
            // 409 the pre-check raises.
            const responses = await Promise.all(
                Array.from({ length: 4 }, () =>
                    agent.post('/api/workspaces').send(validBody())
                )
            );
            const codes = responses.map((res) => res.status).sort();

            expect(codes.filter((code) => code === 201)).toHaveLength(1);
            expect(codes.filter((code) => code === 409)).toHaveLength(3);
            expect(codes).not.toContain(500);

            const list = await agent.get('/api/workspaces').expect(200);
            expect(list.body).toHaveLength(1);
        });
    });

    describe('invited member emails', () => {
        it.each([
            ['whitespace only', '   '],
            ['not an address', 'not-an-email']
        ])(
            'rejects %s instead of provisioning a user',
            async (_label, email) => {
                const { agent } = await loginAs(
                    'admin',
                    'wsr-email@example.com'
                );

                // An invited member is provisioned as a real account keyed on this
                // value; a blank one used to normalise to '' and become a single
                // ghost user that every later blank invite reused.
                await agent
                    .post('/api/workspaces')
                    .send(
                        validBody({
                            members: [
                                { id: email, name: email, email, invited: true }
                            ]
                        })
                    )
                    .expect(400);
            }
        );

        it('still provisions a pending account for a real address', async () => {
            const { agent } = await loginAs('admin', 'wsr-invite@example.com');
            const created = await agent
                .post('/api/workspaces')
                .send(
                    validBody({
                        members: [
                            {
                                id: 'grace@example.com',
                                name: 'Grace',
                                email: 'Grace@Example.com',
                                invited: true
                            }
                        ]
                    })
                )
                .expect(201);

            const emails = (created.body.members as { email: string }[]).map(
                (member) => member.email
            );
            expect(emails).toContain('grace@example.com');
        });
    });

    describe('members array size', () => {
        it('refuses an array past the cap', async () => {
            const { agent } = await loginAs('admin', 'wsr-cap@example.com');

            // Provisioning happens inside the create transaction, so the array
            // length sets how long that transaction is held open.
            const members = Array.from({ length: 201 }, (_unused, i) => ({
                id: `cap${i}@example.com`,
                name: `cap${i}`,
                email: `cap${i}@example.com`,
                invited: true
            }));
            await agent
                .post('/api/workspaces')
                .send(validBody({ members }))
                .expect(400);
        });
    });

    describe('read routes that fed the create/grant decision', () => {
        it('403s the slug probe for a role that cannot create', async () => {
            const { agent } = await loginAs('viewer', 'wsr-probe@example.com');

            // It answers "does this slug exist" — an enumeration of the tenancy
            // for anyone who is merely signed in.
            await agent
                .get('/api/workspaces/slug-available?slug=marketing-site')
                .expect(403);
        });

        it('403s the content-type catalogue for a role that can neither create nor update', async () => {
            const { agent } = await loginAs('viewer', 'wsr-cat@example.com');
            await agent.get('/api/content-types').expect(403);
        });

        it('still serves both to a role that can create', async () => {
            const { agent } = await loginAs('admin', 'wsr-admin@example.com');
            await agent
                .get('/api/workspaces/slug-available?slug=free-slug')
                .expect(200);
            await agent.get('/api/content-types').expect(200);
        });
    });

    describe('deleting a workspace purges its cross-plugin rows', () => {
        it('removes media and token-bucket rows that no foreign key reaches', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-purge@example.com'
            );
            const created = await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'purgeable' }))
                .expect(201);
            const id = created.body.id as string;

            // Only `memberships`, `workspace_content` and copilot's tables
            // carry an FK to `workspaces`. These three do not — media's rows
            // because media is a separate plugin, the token bucket because
            // identity must not depend on the workspaces package — so before
            // the purge they simply outlived the workspace.
            const folder = await seedMediaFolder({
                workspaceId: id,
                name: 'Brand'
            });
            await seedMediaAsset({
                workspaceId: id,
                uploadedBy: user.id,
                name: 'logo.png',
                folderId: folder.id
            });
            await seedMediaAsset({
                workspaceId: id,
                uploadedBy: user.id,
                name: 'loose.pdf'
            });
            await seedApiTokenWorkspaceGrant({
                workspaceId: id,
                createdBy: user.id
            });

            expect(await countMediaAssets(id)).toBe(2);
            expect(await countMediaFolders(id)).toBe(1);
            expect(await countApiTokenGrants(id)).toBe(1);

            await agent.delete(`/api/workspaces/${id}`).expect(204);

            expect(await countMediaAssets(id)).toBe(0);
            expect(await countMediaFolders(id)).toBe(0);
            expect(await countApiTokenGrants(id)).toBe(0);
        });

        it('drops the workspace from a token bucket without revoking the token', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-token@example.com'
            );
            const doomed = await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'doomed' }))
                .expect(201);
            const survivor = await agent
                .post('/api/workspaces')
                .send(validBody({ name: 'Kept', slug: 'kept' }))
                .expect(201);
            const doomedId = doomed.body.id as string;
            const survivorId = survivor.body.id as string;

            const { tokenId } = await seedApiTokenWorkspaceGrant({
                workspaceId: doomedId,
                createdBy: user.id
            });
            await seedApiTokenWorkspaceGrant({
                workspaceId: survivorId,
                createdBy: user.id,
                name: 'second-bucket'
            });

            await agent.delete(`/api/workspaces/${doomedId}`).expect(204);

            // Purging a bucket row narrows a credential's reach; it is not a
            // revocation, which would be a policy call this has no standing
            // to make. The token keeps working in the workspaces that remain.
            expect(await apiTokenExists(tokenId)).toBe(true);
            expect(await countApiTokenGrants(doomedId)).toBe(0);
            expect(await countApiTokenGrants(survivorId)).toBe(1);
        });

        it('leaves another workspace’s rows untouched', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-scope@example.com'
            );
            const doomed = await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'doomed-two' }))
                .expect(201);
            const keeper = await agent
                .post('/api/workspaces')
                .send(validBody({ name: 'Keeper', slug: 'keeper' }))
                .expect(201);
            const doomedId = doomed.body.id as string;
            const keeperId = keeper.body.id as string;

            await seedMediaFolder({ workspaceId: doomedId, name: 'Going' });
            await seedMediaAsset({
                workspaceId: doomedId,
                uploadedBy: user.id,
                name: 'going.pdf'
            });
            await seedMediaFolder({ workspaceId: keeperId, name: 'Staying' });
            await seedMediaAsset({
                workspaceId: keeperId,
                uploadedBy: user.id,
                name: 'staying.pdf'
            });

            await agent.delete(`/api/workspaces/${doomedId}`).expect(204);

            // The purge is a `where workspace_id = …` delete; the whole point
            // is that it cannot be a `delete from media_asset`.
            expect(await countMediaAssets(keeperId)).toBe(1);
            expect(await countMediaFolders(keeperId)).toBe(1);
        });

        it('purges nothing when the delete is refused', async () => {
            const { user, agent } = await loginAs(
                'admin',
                'wsr-refused@example.com'
            );
            const created = await agent
                .post('/api/workspaces')
                .send(validBody({ slug: 'has-content' }))
                .expect(201);
            const id = created.body.id as string;

            await seedMediaFolder({ workspaceId: id, name: 'Kept' });
            await seedMediaAsset({
                workspaceId: id,
                uploadedBy: user.id,
                name: 'kept.pdf'
            });
            // One content entry makes the "no orphaned content" rule bite, so
            // the delete is refused after the purge would already have run.
            await seedArticles([{ text: 'blocking', select: 'a' }], id);

            await agent.delete(`/api/workspaces/${id}`).expect(409);

            // The purge runs inside the transaction, before the workspace row
            // goes — a refused delete must roll it back with everything else.
            expect(await countMediaAssets(id)).toBe(1);
            expect(await countMediaFolders(id)).toBe(1);
        });
    });

    describe('the outbox survives a dispatcher outage', () => {
        it('commits the change, holds the event, and audits it on recovery', async () => {
            const { agent } = await loginAs('admin', 'wsr-outbox@example.com');
            const restore = suspendOutboxDispatch(harness.app);

            try {
                // The mutation must not care that delivery is broken: the
                // outbox write shares its transaction, and `UnitOfWork.run`
                // swallows a failed post-commit drain by design.
                const created = await agent
                    .post('/api/workspaces')
                    .send(validBody({ slug: 'outbox-outage' }))
                    .expect(201);
                const id = created.body.id as string;

                // State change: durable.
                const list = await agent.get('/api/workspaces').expect(200);
                expect(
                    (list.body as { id: string }[]).map((w) => w.id)
                ).toContain(id);

                // Event: recorded, undelivered — not lost, which is the one
                // outcome an outbox exists to rule out.
                const pending = await getOutboxRows(id);
                expect(pending.map((row) => row.kind)).toEqual([
                    'workspace.created'
                ]);
                expect(pending[0].dispatchedAt).toBeNull();

                // Audit: nothing for *this* event yet, because the subscriber
                // never ran. Scoped by kind rather than counting the whole
                // table — logging in already wrote its own row, before the
                // dispatcher was suspended.
                const before = await getActivityRows();
                expect(
                    before.filter((row) => row.kind === 'workspace.created')
                ).toHaveLength(0);

                restore();
                await drainOutbox(harness.app);

                // Recovery delivers exactly once and stamps the row.
                const audited = await getActivityRows();
                expect(
                    audited.filter((row) => row.kind === 'workspace.created')
                ).toHaveLength(1);

                const settled = await getOutboxRows(id);
                expect(settled[0].dispatchedAt).not.toBeNull();
            } finally {
                restore();
            }
        });
    });
});
