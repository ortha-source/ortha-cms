import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import { blobStoreKeys } from '../../support/media-storage';
import {
    listMediaAssets,
    resetDb,
    seedActiveUser,
    seedMediaAsset,
    seedMediaFolder,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-folders-admin@example.com';
const VIEWER = 'media-folders-viewer@example.com';
/** Enough of a file for an upload to succeed; the bytes are never read back. */
const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');

/**
 * `/api/media/folders` — create, list (with the root asset count), rename, and
 * the cascading delete (a folder takes its whole subtree with it).
 */
describe('media folders', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin',
            name: 'Media Admin'
        });
        workspace = await seedWorkspace({
            name: 'Workspace',
            slug: 'workspace'
        });
        await seedMembership(admin.id, workspace.id);
    });

    async function login(email = ADMIN) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    it('creates a folder and lists it with the root count', async () => {
        const agent = await login();

        const created = await agent
            .post('/api/media/folders')
            .send({ name: 'Images' })
            .expect(201);
        expect(created.body).toEqual({ id: expect.any(String) });

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.rootAssetCount).toBe(0);
        expect(res.body.folders).toHaveLength(1);
        expect(res.body.folders[0]).toMatchObject({
            id: created.body.id,
            name: 'Images',
            parentId: null,
            assetCount: 0
        });
    });

    it('renames a folder', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Old'
        });

        await agent
            .patch(`/api/media/folders/${folder.id}`)
            .send({ name: 'New' })
            .expect(200);

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.folders[0].name).toBe('New');
    });

    it('deletes an empty folder (204)', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Empty'
        });

        await agent.delete(`/api/media/folders/${folder.id}`).expect(204);

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.folders).toHaveLength(0);
    });

    it('deletes a non-empty folder together with every level below it [media:I-14]', async () => {
        const agent = await login();
        // Three levels, not two. A tree that is only one deep cannot tell a
        // recursive cascade from a single-level one: both leave nothing behind.
        // The grandchild is the whole point — it is reachable only through the
        // recursive branch of the CTE, so a walk that stops after the direct
        // children fails here and passes on a shallower fixture.
        const parent = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Campaign'
        });
        const child = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Drafts',
            parentId: parent.id
        });
        const grandchild = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Revisions',
            parentId: child.id
        });
        await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'brief.pdf',
            folderId: parent.id
        });
        const nested = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'draft.pdf',
            folderId: child.id
        });
        const deepest = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'revision-3.pdf',
            folderId: grandchild.id
        });
        // A sibling tree of the same shape must survive — the cascade is scoped
        // to the folder it was asked about, not "everything that looks
        // related". Without it, deleting the whole table would pass.
        const sibling = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Archive'
        });
        const siblingChild = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Archive 2019',
            parentId: sibling.id
        });
        const keptNested = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'old.pdf',
            folderId: siblingChild.id
        });
        const untouched = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'keep.pdf',
            folderId: null
        });
        // One asset with real bytes behind it, uploaded rather than seeded, so
        // "the blobs go too" is a claim the store can actually refute. A seeded
        // row never stored anything, which is why `GET .../raw` answering 404
        // for one says nothing about whether it was deleted.
        const withBytes = await agent
            .post('/api/media/assets')
            .field('folderId', grandchild.id)
            .attach('file', PNG, {
                filename: 'proof.png',
                contentType: 'image/png'
            })
            .expect(201);
        expect(blobStoreKeys()).toHaveLength(1);

        await agent.delete(`/api/media/folders/${parent.id}`).expect(204);

        const folders = await agent.get('/api/media/folders').expect(200);
        expect(
            folders.body.folders
                .map((folder: { id: string }) => folder.id)
                .sort()
        ).toEqual([sibling.id, siblingChild.id].sort());

        // Read from the table, not from `GET /api/media/assets`. That route
        // lists **one** folder and an omitted `folderId` means the workspace
        // *root*, so `keptNested` — alive, two levels down a surviving tree —
        // never appears in it either way: through that window a correct cascade
        // and an over-deletion look identical. The claim here spans the
        // workspace, so it is made where the rows are.
        const survivingIds = (await listMediaAssets(workspace.id)).map(
            (asset) => asset.id
        );
        expect(survivingIds.sort()).toEqual(
            [keptNested.id, untouched.id].sort()
        );
        // Which is the same statement as: everything inside the tree went.
        // Spelled out per asset so a failure names the level that survived —
        // `nested` one down, which a single-level cascade also reaches, and
        // `deepest` two, which only the recursive branch does.
        expect(survivingIds).not.toContain(nested.id);
        expect(survivingIds).not.toContain(deepest.id);
        expect(survivingIds).not.toContain(withBytes.body.id);
        // And the bytes went with them, which is a claim only the uploaded
        // asset can carry — the seeded rows never stored a blob.
        expect(blobStoreKeys()).toEqual([]);
    });

    it('cascades only inside the caller\u2019s workspace', async () => {
        // Two workspaces, same-shaped trees, one delete. Note what this can and
        // cannot show: parent links never cross a workspace here, so the walk
        // could not reach the other tenant even with its filters removed. The
        // filter *inside* the CTE is pinned by the next test, which builds the
        // only shape that can follow a link across the boundary.
        const other = await seedWorkspace({ name: 'Other', slug: 'other-ws' });
        await seedMembership(admin.id, other.id);
        const mine = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Shared name'
        });
        const mineChild = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Nested',
            parentId: mine.id
        });
        await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'mine.pdf',
            folderId: mineChild.id
        });
        const theirs = await seedMediaFolder({
            workspaceId: other.id,
            name: 'Shared name'
        });
        const theirAsset = await seedMediaAsset({
            workspaceId: other.id,
            uploadedBy: admin.id,
            name: 'theirs.pdf',
            folderId: theirs.id
        });

        const agent = await login();
        await agent.delete(`/api/media/folders/${mine.id}`).expect(204);

        const otherAgent = await login();
        otherAgent.set('X-Workspace-Id', other.id);
        const folders = await otherAgent.get('/api/media/folders').expect(200);
        expect(folders.body.folders).toHaveLength(1);
        // Still listed inside their folder. (Asserted through the API rather
        // than `/raw`: a seeded asset is a row with no blob behind it.)
        const theirAssets = await otherAgent
            .get(`/api/media/assets?folderId=${theirs.id}`)
            .expect(200);
        expect(theirAssets.body.items.map((a: { id: string }) => a.id)).toEqual(
            [theirAsset.id]
        );
    });

    it('stops the walk where the subtree leaves the workspace [media:I-14]', async () => {
        // The one shape that can tell the CTE's workspace filter apart from its
        // absence: a chain whose middle link belongs to another tenant.
        //
        //   mine (A) › mineChild (A) › stray (B) › deep (A)
        //
        // `stray` is a row the API cannot produce — `POST /media/folders`
        // resolves `parentId` inside the caller's workspace — so it is written
        // straight to the table, which is exactly the corruption the filter is
        // there for. With `child.workspace_id = :ws` on the recursive branch the
        // walk stops at `mineChild`; without it, it descends through B's row and
        // deletes `deep`, a folder in A that this delete was never asked about
        // and that a `FOR UPDATE` re-read scoped to A happily returns.
        const other = await seedWorkspace({
            name: 'Neighbour',
            slug: 'neighbour'
        });
        await seedMembership(admin.id, other.id);
        const mine = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Doomed'
        });
        const mineChild = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Doomed child',
            parentId: mine.id
        });
        const stray = await seedMediaFolder({
            workspaceId: other.id,
            name: 'Foreign link',
            parentId: mineChild.id
        });
        const deep = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Below the boundary',
            parentId: stray.id
        });
        const strayAsset = await seedMediaAsset({
            workspaceId: other.id,
            uploadedBy: admin.id,
            name: 'theirs.pdf',
            folderId: stray.id
        });
        const deepAsset = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'beyond.pdf',
            folderId: deep.id
        });

        const agent = await login();
        await agent.delete(`/api/media/folders/${mine.id}`).expect(204);

        // Everything on this side of the boundary went; `deep` did not, because
        // the walk never got past `stray` to find it.
        const folders = await agent.get('/api/media/folders').expect(200);
        expect(
            folders.body.folders.map((folder: { id: string }) => folder.id)
        ).toEqual([deep.id]);
        // Again from the table: `deepAsset` sits in `deep`, and `deep` hangs off
        // a folder in the other workspace, so nothing this workspace's asset
        // listing can be asked for would return it — `GET /api/media/assets`
        // with no `folderId` is the root folder, and there is no spelling that
        // means "every folder". The row is the observable.
        const survivors = await listMediaAssets(workspace.id);
        expect(survivors.map((asset) => asset.id)).toEqual([deepAsset.id]);

        // And the neighbour is untouched — one workspace's delete does not
        // reach a row it does not own, whatever that row points at.
        const otherAgent = await login();
        otherAgent.set('X-Workspace-Id', other.id);
        const theirFolders = await otherAgent
            .get('/api/media/folders')
            .expect(200);
        expect(
            theirFolders.body.folders.map((folder: { id: string }) => folder.id)
        ).toEqual([stray.id]);
        const theirSurvivors = await listMediaAssets(other.id);
        expect(theirSurvivors.map((asset) => asset.id)).toEqual([
            strayAsset.id
        ]);
    });

    /**
     * The dossier's own checklist item: "create a subfolder under the subtree
     * being deleted, in parallel with the deletion → when it finishes there are
     * no orphaned rows: either the subfolder was deleted along with the tree, or
     * its creation was rejected." Run for all three writes that attach a child
     * to a folder, because all three take the same `FOR SHARE`.
     *
     * There is no FK on `media_folder.parent_id` and none on
     * `media_asset.folder_id`, so nothing but these locks stands between a
     * concurrent write and a row pointing at a parent that no longer exists.
     * The broken implementation is the obvious one: walk the subtree, then
     * delete it, with no lock and no second walk — the write slips in between
     * and survives its own parent.
     */
    describe('a write racing the cascade', () => {
        /** Attempts per racer. The window is a whole transaction wide, but it
         * is still a window; a few rounds make hitting it near-certain. */
        const ROUNDS = 3;

        async function buildTree(agent: ReturnType<typeof request.agent>) {
            const create = async (name: string, parentId?: string) => {
                const res = await agent
                    .post('/api/media/folders')
                    .send(parentId ? { name, parentId } : { name })
                    .expect(201);
                return res.body.id as string;
            };
            const root = await create('Race root');
            const child = await create('Race child', root);
            const grandchild = await create('Race grandchild', child);
            return { root, child, grandchild };
        }

        /**
         * Whatever the interleaving produced, it must be a consistent graph:
         * every surviving folder's parent survives too, and every surviving
         * asset sits in a folder that is still there. Returns what survived.
         */
        async function expectNoOrphans(
            agent: ReturnType<typeof request.agent>
        ) {
            const folders = await agent.get('/api/media/folders').expect(200);
            // The folder listing is workspace-wide; the asset listing is not —
            // it browses one folder, and no `folderId` means the root. Read the
            // assets from the table instead, or every asset checked below sits
            // in the root by construction and the orphan check is vacuous.
            const assets = await listMediaAssets(workspace.id);
            const folderIds = new Set<string>(
                folders.body.folders.map((folder: { id: string }) => folder.id)
            );
            // Asserted as objects rather than bare booleans so a failure names
            // the row that is dangling instead of reading `false !== true`.
            for (const folder of folders.body.folders as {
                id: string;
                parentId: string | null;
            }[]) {
                expect({
                    folder: folder.id,
                    parentSurvives:
                        folder.parentId === null ||
                        folderIds.has(folder.parentId)
                }).toEqual({ folder: folder.id, parentSurvives: true });
            }
            const assetIds = new Set<string>();
            for (const asset of assets) {
                assetIds.add(asset.id);
                expect({
                    asset: asset.id,
                    folderSurvives:
                        asset.folderId === null || folderIds.has(asset.folderId)
                }).toEqual({ asset: asset.id, folderSurvives: true });
            }
            return { folderIds, assetIds };
        }

        it('leaves no orphan when a subfolder is created into it [media:I-13] [media:I-14]', async () => {
            const agent = await login();
            for (let round = 0; round < ROUNDS; round += 1) {
                const tree = await buildTree(agent);

                const [removal, write] = await Promise.all([
                    agent.delete(`/api/media/folders/${tree.root}`),
                    agent
                        .post('/api/media/folders')
                        .send({ name: 'Latecomer', parentId: tree.grandchild })
                ]);

                expect(removal.status).toBe(204);
                // 201 (it took the `FOR SHARE` first, so the delete blocked and
                // its second walk then found the new child) or 404 (it blocked
                // on the `FOR UPDATE` and found no parent afterwards). Never a
                // 500, and never a surviving child of a deleted folder.
                expect([201, 404]).toContain(write.status);
                const { folderIds } = await expectNoOrphans(agent);
                expect(folderIds.has(tree.grandchild)).toBe(false);
                if (write.status === 201) {
                    expect(folderIds.has(write.body.id)).toBe(false);
                }
            }
        });

        it('leaves no orphan when an asset is uploaded into it [media:I-13]', async () => {
            const agent = await login();
            for (let round = 0; round < ROUNDS; round += 1) {
                const tree = await buildTree(agent);

                const [removal, write] = await Promise.all([
                    agent.delete(`/api/media/folders/${tree.root}`),
                    agent
                        .post('/api/media/assets')
                        .field('folderId', tree.grandchild)
                        .attach('file', PNG, {
                            filename: 'race.png',
                            contentType: 'image/png'
                        })
                ]);

                expect(removal.status).toBe(204);
                expect([201, 404]).toContain(write.status);
                const { folderIds, assetIds } = await expectNoOrphans(agent);
                expect(folderIds.has(tree.grandchild)).toBe(false);
                if (write.status === 201) {
                    // It committed before the delete claimed the folder, so the
                    // delete's own asset sweep saw it and took it.
                    expect(assetIds.has(write.body.id)).toBe(false);
                }
            }
        });

        it('leaves no orphan when an asset is moved into it [media:I-13]', async () => {
            const agent = await login();
            for (let round = 0; round < ROUNDS; round += 1) {
                const tree = await buildTree(agent);
                const asset = await seedMediaAsset({
                    workspaceId: workspace.id,
                    uploadedBy: admin.id,
                    name: `mover-${round}.pdf`,
                    folderId: null
                });

                const [removal, write] = await Promise.all([
                    agent.delete(`/api/media/folders/${tree.root}`),
                    agent
                        .patch(`/api/media/assets/${asset.id}`)
                        .send({ folderId: tree.grandchild })
                ]);

                expect(removal.status).toBe(204);
                expect([200, 404]).toContain(write.status);
                const { folderIds, assetIds } = await expectNoOrphans(agent);
                expect(folderIds.has(tree.grandchild)).toBe(false);
                // A move that won the race put the asset inside the doomed
                // folder, so it goes with it; a move that lost never left the
                // root. What must not happen is the third outcome — the asset
                // still pointing at a folder that is gone — and that is what
                // `expectNoOrphans` above rules out.
                expect(assetIds.has(asset.id)).toBe(write.status === 404);
            }
        });
    });

    describe('authorization', () => {
        it('rejects an unauthenticated request with 401', async () => {
            await request(harness.server)
                .get('/api/media/folders')
                .set('X-Workspace-Id', workspace.id)
                .expect(401);
        });

        it('forbids a viewer from creating a folder (403)', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewer.id, workspace.id);
            const agent = await login(VIEWER);

            await agent
                .post('/api/media/folders')
                .send({ name: 'Nope' })
                .expect(403);
        });

        it('lets a viewer read folders (200)', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewer.id, workspace.id);
            const agent = await login(VIEWER);

            await agent.get('/api/media/folders').expect(200);
        });

        it('rejects a disallowed Origin on create (403)', async () => {
            const agent = await login();
            await agent
                .post('/api/media/folders')
                .set('Origin', 'http://evil.example')
                .send({ name: 'x' })
                .expect(403);
        });

        it('allows the configured Origin on create', async () => {
            const agent = await login();
            await agent
                .post('/api/media/folders')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ name: 'ok' })
                .expect(201);
        });
    });
});
