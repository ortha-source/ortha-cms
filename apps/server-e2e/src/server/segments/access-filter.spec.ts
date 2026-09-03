import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import { reloadSegmentCatalogue } from '../../support/segments';

const ADMIN = 'access-filter-admin@example.com';
const PASSWORD = 'SecurePass123!';

const VALUES = { text: 'Article', select: 'article' } as const;

/**
 * Filtering the records list by **who can read a record** —
 * `audienceAllowed` / `audienceDenied` / `accessRestricted`, contributed
 * through content's filter-field registry.
 *
 * They ride the list's own `?filter=` tree, which is what makes this suite worth
 * having in e2e rather than only in a unit: the registry composition, the SQL
 * whitelist the parser builds from it, and the array-overlap subquery are three
 * layers that only meet on a real request.
 */
describe('Filtering records by audience', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;
    let acme: string;
    let globex: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await reloadSegmentCatalogue(harness.app);
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS', slug: 'ws' })).id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);

        const agent = await login();
        acme = await createSegment(agent, 'acme', 'Acme');
        globex = await createSegment(agent, 'globex', 'Globex');
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function createSegment(
        agent: request.Agent,
        key: string,
        label: string
    ): Promise<string> {
        const response = await agent
            .post('/api/segments')
            .send({ key, label })
            .expect(201);
        return response.body.id as string;
    }

    /** An article with the given access, returning its id. */
    async function seedEntry(
        agent: request.Agent,
        text: string,
        access?: { allow?: string[]; deny?: string[] }
    ): Promise<string> {
        const response = await agent
            .post('/api/content/test_article')
            .send({
                values: { ...VALUES, text },
                ...(access
                    ? {
                          extensions: {
                              access: {
                                  allow: access.allow ?? [],
                                  deny: access.deny ?? []
                              }
                          }
                      }
                    : {})
            })
            .expect(201);
        return response.body.id as string;
    }

    /** The texts a filter tree matches, sorted. */
    async function matching(
        agent: request.Agent,
        filter: unknown
    ): Promise<string[]> {
        const response = await agent
            .get('/api/content/test_article')
            .query({ filter: JSON.stringify(filter) })
            .expect(200);
        return response.body.items
            .map((item: { values: { text: string } }) => item.values.text)
            .sort();
    }

    describe('audienceAllowed', () => {
        it('matches entries whose allow list names the audience', async () => {
            const agent = await login();
            await seedEntry(agent, 'For Acme', { allow: [acme] });
            await seedEntry(agent, 'For Globex', { allow: [globex] });
            await seedEntry(agent, 'Open');

            await expect(
                matching(agent, {
                    and: [{ field: 'audienceAllowed', op: 'eq', value: acme }]
                })
            ).resolves.toEqual(['For Acme']);
        });

        it('reads `in` as ANY of, not all of', async () => {
            // "Both" is an `and` of two `eq` rules, which the builder composes —
            // one operator with two readings is the thing nobody could keep
            // straight.
            const agent = await login();
            await seedEntry(agent, 'For Acme', { allow: [acme] });
            await seedEntry(agent, 'For Globex', { allow: [globex] });
            await seedEntry(agent, 'For both', { allow: [acme, globex] });

            await expect(
                matching(agent, {
                    and: [
                        {
                            field: 'audienceAllowed',
                            op: 'in',
                            value: [acme, globex]
                        }
                    ]
                })
                // Sorted, so `both` follows `Globex` — a capital sorts first.
            ).resolves.toEqual(['For Acme', 'For Globex', 'For both']);

            await expect(
                matching(agent, {
                    and: [
                        { field: 'audienceAllowed', op: 'eq', value: acme },
                        { field: 'audienceAllowed', op: 'eq', value: globex }
                    ]
                })
            ).resolves.toEqual(['For both']);
        });
    });

    describe('audienceDenied', () => {
        it('matches the deny list, not the allow list', async () => {
            const agent = await login();
            await seedEntry(agent, 'Refuses Acme', { deny: [acme] });
            await seedEntry(agent, 'Allows Acme', { allow: [acme] });

            await expect(
                matching(agent, {
                    and: [{ field: 'audienceDenied', op: 'eq', value: acme }]
                })
            ).resolves.toEqual(['Refuses Acme']);
        });
    });

    describe('accessRestricted', () => {
        it('splits restricted from open [content:I-17]', async () => {
            const agent = await login();
            await seedEntry(agent, 'Restricted', { allow: [acme] });
            await seedEntry(agent, 'Open');

            await expect(
                matching(agent, {
                    and: [{ field: 'accessRestricted', op: 'eq', value: true }]
                })
            ).resolves.toEqual(['Restricted']);

            await expect(
                matching(agent, {
                    and: [{ field: 'accessRestricted', op: 'eq', value: false }]
                })
            ).resolves.toEqual(['Open']);
        });

        it('counts an entry opened back up as open [segments:I-13]', async () => {
            // The writer deletes the row when both lists empty, so "has a row"
            // *is* "is restricted" — this is the assertion that keeps the two
            // rules from drifting apart.
            const agent = await login();
            const id = await seedEntry(agent, 'Was restricted', {
                allow: [acme]
            });
            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({
                    values: { ...VALUES, text: 'Was restricted' },
                    extensions: { access: { allow: [], deny: [] } }
                })
                .expect(200);

            await expect(
                matching(agent, {
                    and: [{ field: 'accessRestricted', op: 'eq', value: false }]
                })
            ).resolves.toEqual(['Was restricted']);
        });
    });

    describe('what it refuses', () => {
        it('400s an unsupported operator rather than answering it', async () => {
            // Negation is deliberately absent: `ne` negates *inside* the
            // EXISTS — "has some allowed audience other than Acme" — which an
            // entry that also allows Acme satisfies.
            const agent = await login();
            await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [
                            { field: 'audienceAllowed', op: 'ne', value: acme }
                        ]
                    })
                })
                .expect(400);
        });

        it('400s a value that is not a live segment', async () => {
            // The parser coerces against the declared enum, so a stray value
            // cannot reach the `::uuid[]` cast as a 500.
            const agent = await login();
            await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [
                            {
                                field: 'audienceAllowed',
                                op: 'eq',
                                value: 'not-a-segment'
                            }
                        ]
                    })
                })
                .expect(400);
        });

        it('does not offer the fields at all when no audience exists', async () => {
            // Inert until an audience is created: an enum with no values is a
            // rule nobody can complete, so the field is absent from the
            // whitelist and naming it is an unknown-field 400.
            const agent = await login();
            for (const id of [acme, globex]) {
                await agent.delete(`/api/segments/${id}`).expect(204);
            }

            await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [
                            {
                                field: 'accessRestricted',
                                op: 'eq',
                                value: true
                            }
                        ]
                    })
                })
                .expect(400);
        });
    });

    describe('coexistence with the bound extension', () => {
        it('leaves i18n’s own virtual fields answerable', async () => {
            // The registry's whole reason: `CONTENT_ENTRY_EXTENSION` is a single
            // binding held by i18n, so segments binding it would have switched
            // the locale fields off. `test_article` is the localized type.
            const agent = await login();
            await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [{ field: 'hasLocale', op: 'eq', value: 'en' }]
                    })
                })
                .expect(200);
        });

        it('answers an access rule on that same localized type', async () => {
            const agent = await login();
            await agent
                .get('/api/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [
                            {
                                field: 'accessRestricted',
                                op: 'eq',
                                value: false
                            }
                        ]
                    })
                })
                .expect(200);
        });
    });
});
