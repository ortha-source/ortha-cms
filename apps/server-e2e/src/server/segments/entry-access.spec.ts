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
    seedUserWithPermissions,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import { reloadSegmentCatalogue } from '../../support/segments';

const ADMIN = 'access-admin@example.com';
const EDITOR = 'access-editor@example.com';
const PASSWORD = 'SecurePass123!';

const VALUES = { text: 'An article', select: 'article' } as const;

/**
 * Setting who may read an entry — through the entry's **own save**, which is
 * the whole design.
 *
 * Access rides the save body's `extensions` bag, so the access row, the entry
 * row and the revision recording both commit in one transaction. That is what
 * lets a version capture the access it *applied* rather than the access it
 * replaced, and what makes a restore put an entry's audiences back with its
 * words.
 */
describe('Entry access via the entry save', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let editor: SeededUser;
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
        // Someone who may edit the record but not decide who reads it — the
        // principal the extension's own permission check exists for.
        editor = await seedUserWithPermissions(harness.app, {
            email: EDITOR,
            password: PASSWORD,
            roleKey: 'access-editor',
            permissions: [
                'content:read',
                'content:create',
                'content:update',
                'content:publish',
                'segments:read'
            ]
        });
        workspaceId = (await seedWorkspace({ name: 'WS', slug: 'ws' })).id;
        await seedMembership(admin.id, workspaceId);
        await seedMembership(editor.id, workspaceId);
        await seedAllContentGrants(workspaceId);

        const agent = await login(ADMIN);
        acme = await createSegment(agent, 'acme', 'Acme');
        globex = await createSegment(agent, 'globex', 'Globex');
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function createSegment(
        agent: request.Agent,
        key: string,
        label: string,
        workspaceIds?: string[]
    ): Promise<string> {
        const response = await agent
            .post('/api/segments')
            .send({ key, label, ...(workspaceIds ? { workspaceIds } : {}) })
            .expect(201);
        return response.body.id as string;
    }

    /** Read one entry's stored access. */
    async function readAccess(agent: request.Agent, entryId: string) {
        const response = await agent
            .get(`/api/segments/entries/${entryId}`)
            .expect(200);
        return response.body as { allow: string[]; deny: string[] };
    }

    describe('applying it', () => {
        it('writes the audiences a create carried', async () => {
            // A create is the case that forced this into the save at all: until
            // the insert there is no id to write access against.
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [globex] } }
                })
                .expect(201);

            await expect(readAccess(agent, create.body.id)).resolves.toEqual({
                allow: [acme],
                deny: [globex]
            });
        });

        it('leaves access alone when the save does not mention it', async () => {
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);

            await agent
                .patch(`/api/content/test_article/${create.body.id}`)
                .send({ values: { ...VALUES, text: 'Edited' } })
                .expect(200);

            // An omitted key is not a clear — an editor who never opened the
            // Access tab must change nothing.
            await expect(readAccess(agent, create.body.id)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });

        it('opens an entry back up when the save sends two empty lists', async () => {
            // Explicitly empty is a value, not an absence: `key in body` is what
            // tells the two apart.
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);

            await agent
                .patch(`/api/content/test_article/${create.body.id}`)
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [], deny: [] } }
                })
                .expect(200);

            await expect(readAccess(agent, create.body.id)).resolves.toEqual({
                allow: [],
                deny: []
            });
        });

        it('rolls the whole save back on a malformed payload', async () => {
            // The atomicity claim, from the failing side: the entry must not
            // land with a restriction the request could not express.
            const agent = await login(ADMIN);
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: 'acme' } }
                })
                .expect(400);

            const list = await agent
                .get('/api/content/test_article')
                .expect(200);
            expect(list.body.total).toBe(0);
        });

        it('ignores a key no plugin owns', async () => {
            // The bag is forwarded from a client that may be talking to a
            // deployment without that plugin.
            const agent = await login(ADMIN);
            await agent
                .post('/api/content/test_article')
                .send({ values: VALUES, extensions: { nobody: { a: 1 } } })
                .expect(201);
        });
    });

    describe('authorization', () => {
        it('refuses an editor who may write the record but not its access', async () => {
            // The escalation the check exists for: the save asked only for
            // `content:create`, so without it a contributor could restrict any
            // entry they can edit by naming the key in the body.
            const agent = await login(EDITOR);
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(403);
        });

        it('lets that editor save the record without touching access', async () => {
            const agent = await login(EDITOR);
            await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
        });

        it('refuses a segment not offered in this workspace', async () => {
            const asAdmin = await login(ADMIN);
            const other = (
                await seedWorkspace({ name: 'Other', slug: 'other' })
            ).id;
            const elsewhere = await createSegment(
                asAdmin,
                'elsewhere',
                'Elsewhere',
                [other]
            );

            await asAdmin
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [elsewhere], deny: [] } }
                })
                .expect(400);
        });

        it('refuses an unknown segment id', async () => {
            const agent = await login(ADMIN);
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: {
                        access: {
                            allow: ['11111111-1111-4111-8111-111111111111'],
                            deny: []
                        }
                    }
                })
                .expect(400);
        });
    });

    describe('locale groups', () => {
        /** The sibling of `source` in `locale`, sharing its translation group. */
        async function translate(
            agent: request.Agent,
            source: { id: string; localeGroupId?: string },
            locale: string
        ): Promise<string> {
            const response = await agent
                .post('/api/content/test_article')
                .send({
                    values: { ...VALUES, text: `An article (${locale})` },
                    locale,
                    localeGroupId: source.localeGroupId
                })
                .expect(201);
            return response.body.id as string;
        }

        it('applies a decision to every language of the record', async () => {
            // Access is not a translated field: "who may read this" is a fact
            // about the record, not about its German wording. Left per-row, an
            // editor who restricted the English article published the German one
            // to everyone without ever seeing a screen that said so.
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            await agent
                .patch(`/api/content/test_article/${en.body.id}`)
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(200);

            await expect(readAccess(agent, de)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });

        it('reaches a translation created after the decision', async () => {
            // The other order, and the one an editor is likelier to hit: restrict
            // the article, then translate it. i18n copies the row's shared
            // fields; the access row is ours, so the create's own extension pass
            // is what has to carry it — which it does, because the group is
            // resolved from the new row's `localeGroupId`.
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);

            const de = await translate(agent, en.body, 'de');

            await expect(readAccess(agent, de)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });

        it('opens every language back up together', async () => {
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            await agent
                .patch(`/api/content/test_article/${de}`)
                .send({
                    values: { ...VALUES, text: 'An article (de)' },
                    extensions: { access: { allow: [], deny: [] } }
                })
                .expect(200);

            // Both rows, because a half-opened group is a record that is public
            // in one language and not in another.
            await expect(readAccess(agent, en.body.id)).resolves.toEqual({
                allow: [],
                deny: []
            });
            await expect(readAccess(agent, de)).resolves.toEqual({
                allow: [],
                deny: []
            });
        });

        it('writes from whichever language the editor was looking at', async () => {
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            await agent
                .patch(`/api/content/test_article/${de}`)
                .send({
                    values: { ...VALUES, text: 'An article (de)' },
                    extensions: { access: { allow: [globex], deny: [] } }
                })
                .expect(200);

            await expect(readAccess(agent, en.body.id)).resolves.toEqual({
                allow: [globex],
                deny: []
            });
        });

        it('spreads the PUT route’s write too, not only the save’s', async () => {
            // The route stays for an API client that is not saving an entry. It
            // gets neither the atomicity nor the version — but it must not get a
            // different answer about who may read the record.
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            await agent
                .put(`/api/segments/entries/${en.body.id}`)
                .send({
                    typeSlug: 'test_article',
                    allow: [acme],
                    deny: []
                })
                .expect(200);

            await expect(readAccess(agent, de)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });

        it('appends a revision on every sibling it rewrote', async () => {
            // The same thing content does for the rows i18n's shared-field sync
            // rewrote, and for the same reason: a sibling whose stored state
            // moved while its timeline did not is a history that hides the
            // change — and restoring any of its versions would silently undo it.
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            const before = await agent
                .get(`/api/content/test_article/${de}/revisions`)
                .expect(200);

            await agent
                .patch(`/api/content/test_article/${en.body.id}`)
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(200);

            const after = await agent
                .get(`/api/content/test_article/${de}/revisions`)
                .expect(200);
            expect(after.body.items).toHaveLength(before.body.items.length + 1);

            // And it records the audiences, so a restore of that version puts
            // them back rather than reading as a version that had none.
            const newest = after.body.items[0].number as number;
            const version = await agent
                .get(`/api/content/test_article/${de}/revisions/${newest}`)
                .expect(200);
            expect(version.body.snapshot.extra).toEqual({
                access: { allow: [acme], deny: [] }
            });
        });

        it('appends exactly one revision when a save moves both a shared field and access', async () => {
            // `select` carries no `localized` flag, so it is a **shared** field:
            // i18n syncs it to the sibling and reports the row, while the access
            // write reports the same id. Two paths, one row — a second revision
            // would read as a second edit.
            const agent = await login(ADMIN);
            const en = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);
            const de = await translate(agent, en.body, 'de');

            const before = await agent
                .get(`/api/content/test_article/${de}/revisions`)
                .expect(200);

            await agent
                .patch(`/api/content/test_article/${en.body.id}`)
                .send({
                    values: { ...VALUES, select: 'note' },
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(200);

            const after = await agent
                .get(`/api/content/test_article/${de}/revisions`)
                .expect(200);
            expect(after.body.items).toHaveLength(before.body.items.length + 1);
        });

        it('refuses a content type nothing serves', async () => {
            // The slug names the table the group is walked over, so an unknown
            // one is a 400 rather than a row written under a type no read path
            // will ever match.
            const agent = await login(ADMIN);
            const created = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);

            await agent
                .put(`/api/segments/entries/${created.body.id}`)
                .send({ typeSlug: 'not_a_type', allow: [acme], deny: [] })
                .expect(400);
        });

        it('leaves an unlocalized type writing exactly one row', async () => {
            // The group of a type with no locales is the entry, so nothing about
            // this path changes for the installations that have no i18n plugin
            // at all.
            const agent = await login(ADMIN);
            const created = await agent
                .post('/api/content/test_page')
                .send({ values: { title: 'A page' } })
                .expect(201);

            await agent
                .patch(`/api/content/test_page/${created.body.id}`)
                .send({
                    values: { title: 'A page' },
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(200);

            await expect(readAccess(agent, created.body.id)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });
    });

    describe('revisions', () => {
        it('captures the access the save applied, not the one it replaced', async () => {
            // The property a separate later request could never have: a
            // revision is built inside the write.
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);
            const id = create.body.id as string;

            const version = await agent
                .get(`/api/content/test_article/${id}/revisions/1`)
                .expect(200);
            expect(version.body.snapshot.extra).toEqual({
                access: { allow: [acme], deny: [] }
            });
        });

        it('records the access of a save that never mentioned it', async () => {
            // `capture` runs for every snapshot. A version that recorded state
            // only when it changed would restore as a version that had none —
            // and quietly open the entry up.
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALUES, text: 'Edited' } })
                .expect(200);

            const version = await agent
                .get(`/api/content/test_article/${id}/revisions/2`)
                .expect(200);
            expect(version.body.snapshot.extra).toEqual({
                access: { allow: [acme], deny: [] }
            });
        });

        it('records nothing for an unrestricted entry', async () => {
            // So a snapshot of ordinary open content is byte-for-byte what it
            // was before the extension existed.
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALUES })
                .expect(201);

            const version = await agent
                .get(`/api/content/test_article/${create.body.id}/revisions/1`)
                .expect(200);
            expect(version.body.snapshot.extra).toBeUndefined();
        });

        it('puts a restored version’s audiences back with its words', async () => {
            const agent = await login(ADMIN);
            const create = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALUES,
                    extensions: { access: { allow: [acme], deny: [] } }
                })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({
                    values: { ...VALUES, text: 'Rewritten' },
                    extensions: { access: { allow: [globex], deny: [] } }
                })
                .expect(200);
            await expect(readAccess(agent, id)).resolves.toEqual({
                allow: [globex],
                deny: []
            });

            await agent
                .post(`/api/content/test_article/${id}/revisions/1/restore`)
                .expect(201);

            const restored = await agent
                .get(`/api/content/test_article/${id}`)
                .expect(200);
            expect(restored.body.values.text).toBe('An article');
            // The quiet half of a restore: without it, Tuesday's words would be
            // back in front of today's readers.
            await expect(readAccess(agent, id)).resolves.toEqual({
                allow: [acme],
                deny: []
            });
        });
    });
});
