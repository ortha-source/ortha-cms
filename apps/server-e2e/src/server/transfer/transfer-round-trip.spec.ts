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

const ADMIN_EMAIL = 'transfer-admin@example.com';
const VIEWER_EMAIL = 'transfer-viewer@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * Export and import over the real content graph.
 *
 * The suite that matters here is the **round trip**: export a graph, wipe it,
 * import the file, and assert the graph came back — because every other test in
 * this plugin can pass while the feature is still useless. A serializer whose
 * parser disagrees with it, an identity rule that never matches, a link written
 * with a source id: each of those produces a green unit test and a file nobody
 * can import.
 *
 * `test_article` is the fixture on purpose — it is publishable, paranoid, localized,
 * and carries a relation of every cardinality.
 *
 * The depth tests root themselves at `test_comment` instead, because the chain
 * `test_comment` → `test_article` → `test_author` is three levels deep and an
 * article alone is two. Only a graph with a depth-2 record can tell a one-hop
 * walk apart from a recursive one.
 */
describe('Content transfer (/api/content/:type/export, /import)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const ws = await seedWorkspace({ name: 'Transfer WS', slug: 'ws-tx' });
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);
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

    /** Creates an author and returns its id. */
    async function createAuthor(
        agent: request.Agent,
        name: string,
        email: string
    ): Promise<string> {
        const res = await agent
            .post('/api/content/test_author')
            // `test_author` is localized here too, so the row needs a locale.
            .send({ locale: 'en', values: { name, email } })
            .expect(201);
        return res.body.id as string;
    }

    /** Creates an English article and returns its id. */
    async function createArticle(
        agent: request.Agent,
        values: Record<string, unknown>
    ): Promise<string> {
        const res = await agent
            .post('/api/content/test_article')
            .send({ locale: 'en', values })
            .expect(201);
        return res.body.id as string;
    }

    /** Creates a comment on `articleId` and returns its id. */
    async function createComment(
        agent: request.Agent,
        articleId: string,
        body: string
    ): Promise<string> {
        const res = await agent
            .post('/api/content/test_comment')
            // `test_comment` is not localized, so it carries no locale.
            .send({ values: { author: 'Grace', body, article: articleId } })
            .expect(201);
        return res.body.id as string;
    }

    /** Reads an entry, or `undefined` when it is gone. */
    async function readEntry(
        agent: request.Agent,
        type: string,
        id: string
    ): Promise<Record<string, unknown> | undefined> {
        const res = await agent.get(`/api/content/${type}/${id}`);
        return res.status === 200 ? res.body : undefined;
    }

    /** Lists a type's entries. */
    async function listEntries(
        agent: request.Agent,
        type: string
    ): Promise<{ id: string; values: Record<string, unknown> }[]> {
        const res = await agent
            .get(`/api/content/${type}?pageSize=100`)
            .expect(200);
        return res.body.items;
    }

    describe('export', () => {
        it('exports a related record in full, and links to it by natural key', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'Hello world',
                select: 'article',
                author: authorId
            });

            const res = await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: [articleId],
                    format: 'json',
                    depth: { relations: true, media: false, locales: true }
                })
                .expect(200);

            const document = JSON.parse(res.text);
            expect(document.manifest.rootType).toBe('test_article');
            expect(document.manifest.version).toBe(1);

            const article = document.records.find(
                (record: { $type: string }) => record.$type === 'test_article'
            );
            const author = document.records.find(
                (record: { $type: string }) => record.$type === 'test_author'
            );

            expect(article.$depth).toBe(0);
            expect(article.values.text).toBe('Hello world');
            expect(article.$locale).toBe('en');
            // The author came along as a full record, one hop out…
            expect(author.$depth).toBe(1);
            expect(author.values.name).toBe('Ada');
            // …and the link between them is a resolvable key, not a row id.
            expect(article.relations.author).toMatchObject({
                $type: 'test_author',
                $key: { email: 'ada@x.test' }
            });
        });

        it('stops at one hop: a depth-2 record travels as a reference, never as a record [transfer:I-03]', async () => {
            const agent = await login(ADMIN_EMAIL);
            // A three-level chain — comment -> article -> author — is what
            // makes this test able to fail at all. With the author sitting at
            // depth 2, a walk that followed depth-1's relations outward would
            // put a `test_author` record in the document; a one-hop walk
            // cannot. A graph that stopped at the article would not tell the
            // two implementations apart.
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'the middle of the chain',
                select: 'article',
                author: authorId
            });
            const commentId = await createComment(
                agent,
                articleId,
                'Nice piece'
            );

            const res = await agent
                .post('/api/content/test_comment/export')
                .send({
                    ids: [commentId],
                    format: 'json',
                    depth: { relations: true, media: false, locales: true }
                })
                .expect(200);

            const document = JSON.parse(res.text);
            expect(document.manifest.rootType).toBe('test_comment');

            const records = document.records as {
                $type: string;
                $depth: number;
                values: Record<string, unknown>;
                relations: Record<string, { $type: string; $key: unknown }>;
            }[];
            const comment = records.find(
                (record) => record.$type === 'test_comment'
            );
            const article = records.find(
                (record) => record.$type === 'test_article'
            );

            // Depth 0 and depth 1 arrive in full…
            expect(comment?.$depth).toBe(0);
            expect(comment?.values['author']).toBe('Grace');
            expect(article?.$depth).toBe(1);
            expect(article?.values['text']).toBe('the middle of the chain');
            // …and the author, one hop further out, is not in the file at all.
            expect(records).toHaveLength(2);
            expect(records.map((record) => record.$type)).not.toContain(
                'test_author'
            );
            expect(document.manifest.counts).toMatchObject({
                roots: 1,
                related: 1
            });

            // It is present only as the depth-1 record's reference — and that
            // reference still carries a resolvable natural key rather than a
            // bare foreign row id, because the walk stops at the records, not
            // at the references.
            expect(article?.relations['author']).toMatchObject({
                $type: 'test_author',
                $key: { email: 'ada@x.test' }
            });
            expect(
                (article?.relations['author'] as Record<string, unknown>)[
                    'values'
                ]
            ).toBeUndefined();
        });

        it('leaves relations out when they are not asked for [transfer:I-04]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'solo',
                select: 'article',
                author: authorId
            });

            const res = await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: [articleId],
                    format: 'json',
                    depth: { relations: false, media: false, locales: false }
                })
                .expect(200);

            const document = JSON.parse(res.text);
            expect(
                document.records.every(
                    (record: { $type: string }) =>
                        record.$type === 'test_article'
                )
            ).toBe(true);
            // The reference survives even though the record did not — which is
            // what lets an import link it to an author the target already has.
            expect(document.records[0].relations.author.$key).toEqual({
                email: 'ada@x.test'
            });
        });

        it('previews the very numbers the export then carries [transfer:I-06]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'counted',
                select: 'article',
                author: authorId
            });
            // Two roots sharing one relation, which is the shape a preview
            // computed a cheaper way gets wrong: counting references instead of
            // records reports two related records where the export carries one.
            // The article's own author sits at depth 2, so neither number
            // counts it.
            const first = await createComment(agent, articleId, 'First');
            const second = await createComment(agent, articleId, 'Second');
            const body = {
                ids: [first, second],
                format: 'json',
                depth: { relations: true, media: false, locales: true }
            };

            const preview = await agent
                .post('/api/content/test_comment/export/preview')
                .send(body)
                .expect(200);

            expect(preview.body).toMatchObject({
                roots: 2,
                related: 1,
                assets: 0,
                // JSON carries no bytes, so the dialog must not imply a
                // download of that size.
                carriesFileBytes: false
            });
            // Counting is all it did: nothing was written and no file produced.
            expect(preview.headers['content-disposition']).toBeUndefined();

            // The same request, actually run, arrives with exactly those
            // numbers — which is the whole promise the dialog makes.
            const res = await agent
                .post('/api/content/test_comment/export')
                .send(body)
                .expect(200);
            const records = JSON.parse(res.text).records as {
                $depth: number;
            }[];
            expect(
                records.filter((record) => record.$depth === 0)
            ).toHaveLength(preview.body.roots);
            expect(
                records.filter((record) => record.$depth === 1)
            ).toHaveLength(preview.body.related);
            expect(res.headers['x-transfer-records']).toBe(
                String(records.length)
            );
        });

        it('streams a ZIP when files are asked for, with the record files inside', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'archived',
                select: 'article',
                author: authorId
            });

            const res = await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: [articleId],
                    format: 'zip',
                    depth: { relations: true, media: true, locales: true }
                })
                .buffer()
                .parse((response, callback) => {
                    const chunks: Buffer[] = [];
                    response.on('data', (chunk: Buffer) =>
                        chunks.push(Buffer.from(chunk))
                    );
                    response.on('end', () =>
                        callback(null, Buffer.concat(chunks))
                    );
                })
                .expect(200);

            const body = res.body as Buffer;
            expect(res.headers['content-type']).toContain('application/zip');
            expect(res.headers['content-disposition']).toContain('.zip');
            // Local file header signature — this is a real archive, and the
            // unit suite proves the container round-trips.
            expect(body.subarray(0, 4).toString('hex')).toBe('504b0304');
        });

        it('exports a CSV whose header matches the type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'flat',
                select: 'article',
                author: authorId
            });

            const res = await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: [articleId],
                    format: 'csv',
                    depth: { relations: false, media: false, locales: false }
                })
                .expect(200);

            const [header, row] = res.text.split('\r\n');
            expect(header.split(',')).toEqual(
                expect.arrayContaining(['$id', '$locale', 'text', 'select'])
            );
            expect(row).toContain('flat');
        });

        it('offers a blank CSV template for the type', async () => {
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .get('/api/content/test_article/import/template')
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text.split('\r\n')).toHaveLength(1);
            expect(res.text).toContain('select');
        });
    });

    describe('import', () => {
        /** Exports `ids` as JSON and returns the raw document text. */
        async function exportJson(
            agent: request.Agent,
            ids: string[],
            depth: Record<string, boolean> = {
                relations: true,
                media: false,
                locales: true
            }
        ): Promise<string> {
            const res = await agent
                .post('/api/content/test_article/export')
                .send({ ids, format: 'json', depth })
                .expect(200);
            return res.text;
        }

        /**
         * Uploads a document to one of the import routes.
         *
         * `relations` is left off unless a test is about it, so the default
         * every test but those exercises is the server's own — which is the
         * thing worth having covered.
         */
        function upload(
            agent: request.Agent,
            path: string,
            body: string,
            policy = 'skip',
            relations?: string
        ) {
            const req = agent.post(path).field('policy', policy);
            if (relations) req.field('relations', relations);
            return req.attach('file', Buffer.from(body, 'utf8'), 'export.json');
        }

        /** The verdict for one record type, out of a preview or a result. */
        function verdictFor(
            body: { verdicts: { $type: string }[] },
            type: string
        ) {
            return body.verdicts.find((verdict) => verdict.$type === type);
        }

        it('round-trips a graph: export, wipe, import, and it is back [transfer:I-11] [transfer:I-15]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'round-trip',
                select: 'article',
                number: 42,
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            // Wipe both records. `article` is paranoid, so DELETE only trashes
            // it and purge is what actually removes the row — and it has to be
            // gone before the author can go, because `article.author` is a
            // required relation with ON DELETE RESTRICT.
            await agent
                .delete(`/api/content/test_article/${articleId}`)
                .expect(204);
            await agent
                .post('/api/content/test_article/bulk/purge')
                .send({ ids: [articleId] })
                .expect(200);
            // `author` is not paranoid, so this removes the row outright.
            await agent
                .delete(`/api/content/test_author/${authorId}`)
                .expect(204);

            expect(await listEntries(agent, 'test_article')).toHaveLength(0);
            expect(await listEntries(agent, 'test_author')).toHaveLength(0);

            const applied = await upload(
                agent,
                '/api/content/test_article/import',
                document
            ).expect(200);

            expect(applied.body.counts.create).toBeGreaterThanOrEqual(2);
            expect(applied.body.counts.error).toBe(0);

            const articles = await listEntries(agent, 'test_article');
            const authors = await listEntries(agent, 'test_author');
            expect(articles).toHaveLength(1);
            expect(authors).toHaveLength(1);
            // The scalar fields survived the link pass — the bug that pass had
            // was blanking every field it did not resend.
            expect(articles[0].values['text']).toBe('round-trip');
            expect(articles[0].values['number']).toBe(42);
            expect(articles[0].values['select']).toBe('article');

            // The link was rebuilt against the *new* author row, not the id the
            // file carried — the whole point of the natural key.
            const rebuilt = await readEntry(
                agent,
                'test_article',
                articles[0].id
            );
            expect(rebuilt?.['values']).toMatchObject({
                author: authors[0].id
            });
        });

        it('dry-runs without writing, and says what it would do [transfer:I-08]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'preview-me',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            const before = await listEntries(agent, 'test_article');
            const preview = await upload(
                agent,
                '/api/content/test_article/import/preview',
                document
            ).expect(200);

            // Everything in the file is already here, so the honest answer is
            // "nothing would change" — and nothing did.
            expect(preview.body.counts.skip).toBeGreaterThan(0);
            expect(preview.body.hasChanges).toBe(false);
            // The two depths are reported differently on purpose: the article
            // is the record you asked for and the conflict policy left it
            // alone; the author came along with it and the relation policy
            // linked to it. Same action, different question answered.
            expect(verdictFor(preview.body, 'test_article')).toMatchObject({
                action: 'skip',
                reason: 'conflict-skipped'
            });
            expect(verdictFor(preview.body, 'test_author')).toMatchObject({
                action: 'skip',
                reason: 'relation-linked'
            });
            expect(await listEntries(agent, 'test_article')).toHaveLength(
                before.length
            );
        });

        it('skips an existing record by default rather than duplicating it', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'same-slug',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'skip'
            ).expect(200);

            // Re-importing the same file is the commonest thing anyone does.
            expect(await listEntries(agent, 'test_article')).toHaveLength(1);
        });

        it('updates the matched record when the policy says so', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'edit-me',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            // Edit the live record, then re-import the older file over it.
            await agent
                .patch(`/api/content/test_article/${articleId}`)
                .send({ values: { text: 'changed-in-cms', select: 'article' } })
                .expect(200);

            await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'update'
            ).expect(200);

            const entries = await listEntries(agent, 'test_article');
            expect(entries).toHaveLength(1);
            expect(entries[0].values['text']).toBe('edit-me');
        });

        it('adds a second copy when the policy says duplicate', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'twin',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId], {
                relations: false,
                media: false,
                locales: false
            });

            await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'duplicate'
            ).expect(200);

            expect(await listEntries(agent, 'test_article')).toHaveLength(2);
        });

        it('links a related record that is already here instead of adding another [transfer:I-15] [transfer:I-16]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'has-an-author',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            // Only the article goes. The author stays exactly where it is —
            // this is the shape of every real import: the records are new, the
            // things they point at are already here.
            await agent
                .delete(`/api/content/test_article/${articleId}`)
                .expect(204);
            await agent
                .post('/api/content/test_article/bulk/purge')
                .send({ ids: [articleId] })
                .expect(200);

            const applied = await upload(
                agent,
                '/api/content/test_article/import',
                document
            ).expect(200);

            expect(verdictFor(applied.body, 'test_author')).toMatchObject({
                action: 'skip',
                reason: 'relation-linked'
            });
            // One author, still the original row — not a second Ada.
            const authors = await listEntries(agent, 'test_author');
            expect(authors).toHaveLength(1);
            expect(authors[0].id).toBe(authorId);

            const articles = await listEntries(agent, 'test_article');
            expect(articles).toHaveLength(1);
            const rebuilt = await readEntry(
                agent,
                'test_article',
                articles[0].id
            );
            expect(rebuilt?.['values']).toMatchObject({ author: authorId });
        });

        it('writes a fresh related record when the relation policy says recreate', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'recreate-my-author',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            await agent
                .delete(`/api/content/test_article/${articleId}`)
                .expect(204);
            await agent
                .post('/api/content/test_article/bulk/purge')
                .send({ ids: [articleId] })
                .expect(200);

            const applied = await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'skip',
                'recreate'
            ).expect(200);

            expect(verdictFor(applied.body, 'test_author')).toMatchObject({
                action: 'create',
                reason: 'relation-recreated'
            });
            const authors = await listEntries(agent, 'test_author');
            expect(authors).toHaveLength(2);

            // And the article points at the new copy, not the original.
            const articles = await listEntries(agent, 'test_article');
            const rebuilt = await readEntry(
                agent,
                'test_article',
                articles[0].id
            );
            const linked = rebuilt?.['values'] as Record<string, unknown>;
            expect(linked['author']).not.toBe(authorId);
            expect(authors.map((author) => author.id)).toContain(
                linked['author']
            );
        });

        it('updates the related record from the file when asked to', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'author-edited-later',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            // The author is edited after the export, so the file's copy is the
            // older one — which is exactly what `update` asks to restore.
            await agent
                .patch(`/api/content/test_author/${authorId}`)
                .send({ values: { name: 'Renamed', email: 'ada@x.test' } })
                .expect(200);

            await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'skip',
                'update'
            ).expect(200);

            const authors = await listEntries(agent, 'test_author');
            expect(authors).toHaveLength(1);
            expect(authors[0].values['name']).toBe('Ada');
        });

        it('keeps the two policies apart: duplicate the record, link its author [transfer:I-14]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'twin-with-one-author',
                select: 'article',
                author: authorId
            });
            const document = await exportJson(agent, [articleId]);

            // `duplicate` governs the records the caller selected. It must not
            // reach the author, or "add a second copy of this article" would
            // silently mean "and a second copy of everything it points at".
            await upload(
                agent,
                '/api/content/test_article/import',
                document,
                'duplicate'
            ).expect(200);

            expect(await listEntries(agent, 'test_article')).toHaveLength(2);
            const authors = await listEntries(agent, 'test_author');
            expect(authors).toHaveLength(1);
            expect(authors[0].id).toBe(authorId);
        });

        it('never writes across workspaces, whatever the manifest claims [transfer:I-23]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'scoped',
                select: 'article',
                author: authorId
            });
            const document = JSON.parse(
                await exportJson(agent, [articleId], {
                    relations: false,
                    media: false,
                    locales: false
                })
            );

            // A second workspace the admin also belongs to, and a manifest
            // hand-edited to name it.
            const other = await seedWorkspace({
                name: 'Other WS',
                slug: 'ws-other'
            });
            await seedMembership(admin.id, other.id);
            await seedAllContentGrants(other.id);
            document.manifest.sourceWorkspaceId = other.id;
            document.records[0].values.text = 'forged';
            // A foreign row id as well as a foreign key, because a document
            // from somewhere else would carry one. Leaving this database's own
            // id on it would make the record match the row it was exported
            // from, and the import would correctly skip it — a true answer to
            // a different question than the one this test asks.
            document.records[0].$id = '9a7f1c62-4d38-4f0a-8b21-6e3c9d41f775';

            await upload(
                agent,
                '/api/content/test_article/import',
                JSON.stringify(document)
            ).expect(200);

            // Written into the request's workspace, not the manifest's.
            const here = await listEntries(agent, 'test_article');
            expect(here.map((entry) => entry.values['text'])).toContain(
                'forged'
            );

            const otherAgent = await login(ADMIN_EMAIL);
            otherAgent.set('X-Workspace-Id', other.id);
            const there = await listEntries(otherAgent, 'test_article');
            expect(there).toHaveLength(0);
        });

        it('refuses a document written by a newer format version [transfer:I-27]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(agent, 'Ada', 'ada@x.test');
            const articleId = await createArticle(agent, {
                text: 'future',
                select: 'article',
                author: authorId
            });
            const document = JSON.parse(await exportJson(agent, [articleId]));
            document.manifest.version = 99;

            const res = await upload(
                agent,
                '/api/content/test_article/import/preview',
                JSON.stringify(document)
            ).expect(400);

            expect(res.body.message).toMatch(/newer version/i);
        });

        it('rejects a file that is not a transfer document', async () => {
            const agent = await login(ADMIN_EMAIL);
            await upload(
                agent,
                '/api/content/test_article/import/preview',
                'this is not json'
            ).expect(400);
        });

        it('requires a file at all', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/import/preview')
                .field('policy', 'skip')
                .expect(400);
        });
    });

    describe('permissions', () => {
        beforeEach(async () => {
            await seedActiveUser(harness.app, {
                email: VIEWER_EMAIL,
                password: PASSWORD,
                role: 'viewer'
            });
        });

        it('refuses export to a viewer, who may read but not take the library', async () => {
            const admins = await login(ADMIN_EMAIL);
            const authorId = await createAuthor(admins, 'Ada', 'ada@x.test');
            const articleId = await createArticle(admins, {
                text: 'not-yours',
                select: 'article',
                author: authorId
            });

            const viewerUser = await seedActiveUser(harness.app, {
                email: `v2-${VIEWER_EMAIL}`,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewerUser.id, workspaceId);

            const viewer = request.agent(harness.server);
            await viewer
                .post('/api/auth/login')
                .send({ email: `v2-${VIEWER_EMAIL}`, password: PASSWORD })
                .expect(201);
            viewer.set('X-Workspace-Id', workspaceId);

            // The viewer can read this very record…
            await viewer
                .get(`/api/content/test_article/${articleId}`)
                .expect(200);
            // …and still cannot export it. Bulk egress is a separate capability.
            await viewer
                .post('/api/content/test_article/export')
                .send({ ids: [articleId], format: 'json' })
                .expect(403);
        });

        it('refuses import to a viewer', async () => {
            const viewerUser = await seedActiveUser(harness.app, {
                email: `v3-${VIEWER_EMAIL}`,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewerUser.id, workspaceId);

            const viewer = request.agent(harness.server);
            await viewer
                .post('/api/auth/login')
                .send({ email: `v3-${VIEWER_EMAIL}`, password: PASSWORD })
                .expect(201);
            viewer.set('X-Workspace-Id', workspaceId);

            await viewer
                .post('/api/content/test_article/import')
                .field('policy', 'skip')
                .attach('file', Buffer.from('{}', 'utf8'), 'x.json')
                .expect(403);
        });

        it('refuses a signed-out caller', async () => {
            await request(harness.server)
                .post('/api/content/test_article/export')
                .set('X-Workspace-Id', workspaceId)
                .send({ ids: [], format: 'json' })
                .expect(401);
        });

        it('hides a content type the workspace was never granted [transfer:I-24]', async () => {
            const agent = await login(ADMIN_EMAIL);
            const ungranted = await seedWorkspace({
                name: 'Bare WS',
                slug: 'ws-bare'
            });
            await seedMembership(admin.id, ungranted.id);
            agent.set('X-Workspace-Id', ungranted.id);

            // Same 404 an unknown type gets — the route carries no signal about
            // which types exist elsewhere.
            await agent
                .post('/api/content/test_article/export')
                .send({ ids: [], format: 'json' })
                .expect(404);
        });
    });

    describe('validation', () => {
        it('rejects an unknown format', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: ['3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91'],
                    format: 'xlsx'
                })
                .expect(400);
        });

        it('rejects an empty selection [transfer:I-39]', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/export')
                .send({ ids: [], format: 'json' })
                .expect(400);
        });

        it('rejects an unknown body field', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/export')
                .send({
                    ids: ['3f1a7c1e-9d2b-4a6f-8c11-5b8e2f0d7a91'],
                    format: 'json',
                    everything: true
                })
                .expect(400);
        });

        it('rejects an unknown conflict policy', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/import')
                .field('policy', 'obliterate')
                .attach('file', Buffer.from('{}', 'utf8'), 'x.json')
                .expect(400);
        });

        it('rejects an unknown relation policy', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/test_article/import')
                .field('relations', 'entangle')
                .attach('file', Buffer.from('{}', 'utf8'), 'x.json')
                .expect(400);
        });
    });
});
