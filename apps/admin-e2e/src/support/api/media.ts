import { type Page } from '@playwright/test';

/** An asset as the media API returns it (mirrors the server's `AssetView`). */
export interface AssetResponse {
    id: string;
    name: string;
    folderId: string | null;
    kind: string;
    mimeType: string;
    size: number;
    url: string;
    /**
     * Names of the server-generated derivatives (`thumb` / `preview`), fetched
     * at `${url}?variant=<name>`. The mapper reads this, so it must be present
     * on every asset — `[]` for a non-image.
     */
    variants: string[];
    width: number | null;
    height: number | null;
    duration: number | null;
    tags: string[];
    alt: string | null;
    uploadedBy: string;
    createdAt: string;
    updatedAt: string;
}

/** A folder as the media API returns it (mirrors the server's `FolderView`). */
export interface FolderResponse {
    id: string;
    name: string;
    parentId: string | null;
    assetCount: number;
    createdAt: string;
}

const NOW = '2026-07-01T12:00:00.000Z';
const raw = (id: string) => `/api/media/assets/${id}/raw`;

const asset = (
    over: Partial<AssetResponse> & { id: string; name: string }
): AssetResponse => ({
    folderId: null,
    kind: 'document',
    mimeType: 'application/pdf',
    size: 2048,
    url: raw(over.id),
    // Images derive; everything else keeps the original only. Overridable.
    variants: over.kind === 'image' ? ['thumb', 'preview'] : [],
    width: null,
    height: null,
    duration: null,
    tags: [],
    alt: null,
    uploadedBy: 'Ada Lovelace',
    createdAt: NOW,
    updatedAt: NOW,
    ...over
});

/**
 * Asset ids are **uuids**, as the real API's are — a media field stores the id
 * in the entry values, where the shared validation kernel shape-checks it, so a
 * friendlier `a_hero` would be rejected client-side before any save.
 */
export const MEDIA_ASSET_IDS = {
    hero: '11111111-1111-4111-8111-111111111111',
    report: '22222222-2222-4222-8222-222222222222',
    inside: '33333333-3333-4333-8333-333333333333'
} as const;

/** The uuid the upload mock mints for the `n`-th file it accepts (1-based). */
export function uploadedAssetId(n: number): string {
    return `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
}

/** Deterministic seed: one folder + a couple of root assets. */
export const MEDIA_SEED = {
    folders: [
        {
            id: 'fold_images',
            name: 'Images',
            parentId: null,
            assetCount: 1,
            createdAt: NOW
        }
    ] as FolderResponse[],
    assets: [
        asset({
            id: MEDIA_ASSET_IDS.hero,
            name: 'hero.png',
            kind: 'image',
            mimeType: 'image/png',
            width: 1200,
            height: 800
        }),
        asset({ id: MEDIA_ASSET_IDS.report, name: 'report.pdf' }),
        asset({
            id: MEDIA_ASSET_IDS.inside,
            name: 'inside.png',
            kind: 'image',
            mimeType: 'image/png',
            folderId: 'fold_images'
        })
    ] as AssetResponse[]
};

// A 1×1 transparent PNG so <img src="/raw"> loads without a broken-image error.
const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
});

const segments = (url: string): string[] => new URL(url).pathname.split('/');

/** Tracks upload calls so a test can assert an upload was submitted. */
export interface MediaUploadSpy {
    readonly count: number;
}

/**
 * Stub the media API with a **stateful** in-memory store, so a spec can drive
 * the full Media Library against a deterministic backend: folders + assets read,
 * multipart upload (parses the filename from the body), create/rename/delete
 * folder (409 when non-empty), patch/duplicate/bulk-delete assets, and the
 * `/raw` byte route (a 1px PNG). Returns an upload spy.
 */
export async function mockMediaApi(page: Page): Promise<MediaUploadSpy> {
    const folders = MEDIA_SEED.folders.map((f) => ({ ...f }));
    const assets = MEDIA_SEED.assets.map((a) => ({ ...a }));
    let uploads = 0;
    let seq = 0;
    const nextId = (prefix: string) => `${prefix}_${(seq += 1)}`;
    // Assets get uuids (see MEDIA_ASSET_IDS); folders keep readable ids, since
    // nothing validates their shape.
    const nextAssetId = () => uploadedAssetId((seq += 1));

    const rootCount = () => assets.filter((a) => a.folderId === null).length;
    const withCounts = (): FolderResponse[] =>
        folders.map((f) => ({
            ...f,
            assetCount: assets.filter((a) => a.folderId === f.id).length
        }));

    // GET (list) + POST (create) folders.
    await page.route(/\/api\/media\/folders(\?.*)?$/, async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
            await route.fulfill(
                json({ folders: withCounts(), rootAssetCount: rootCount() })
            );
            return;
        }
        if (method === 'POST') {
            const body = route.request().postDataJSON() as {
                name: string;
                parentId?: string;
            };
            const created: FolderResponse = {
                id: nextId('fold'),
                name: body.name,
                parentId: body.parentId ?? null,
                assetCount: 0,
                createdAt: NOW
            };
            folders.push(created);
            await route.fulfill(json({ id: created.id }, 201));
            return;
        }
        await route.fallback();
    });

    // PATCH (rename) + DELETE (empty-only) a folder.
    await page.route(
        /\/api\/media\/folders\/([^/?]+)(\?.*)?$/,
        async (route) => {
            const id = segments(route.request().url())[4];
            const folder = folders.find((f) => f.id === id);
            const method = route.request().method();
            if (method === 'PATCH') {
                if (folder) {
                    const { name } = route.request().postDataJSON() as {
                        name: string;
                    };
                    folder.name = name;
                }
                await route.fulfill(json({ id }));
                return;
            }
            if (method === 'DELETE') {
                const nonEmpty =
                    assets.some((a) => a.folderId === id) ||
                    folders.some((f) => f.parentId === id);
                if (nonEmpty) {
                    await route.fulfill(
                        json({ message: 'Folder not empty' }, 409)
                    );
                    return;
                }
                const index = folders.findIndex((f) => f.id === id);
                if (index >= 0) folders.splice(index, 1);
                await route.fulfill({ status: 204, body: '' });
                return;
            }
            await route.fallback();
        }
    );

    // GET (list) + POST (upload) + DELETE (bulk) assets.
    await page.route(/\/api\/media\/assets(\?.*)?$/, async (route) => {
        const request = route.request();
        const method = request.method();
        if (method === 'GET') {
            const folderId = new URL(request.url()).searchParams.get(
                'folderId'
            );
            const items = assets.filter((a) =>
                folderId ? a.folderId === folderId : a.folderId === null
            );
            await route.fulfill(
                json({ items, total: items.length, page: 1, pageSize: 100 })
            );
            return;
        }
        if (method === 'POST') {
            uploads += 1;
            const body = request.postData() ?? '';
            const nameMatch = body.match(/filename="([^"]+)"/);
            const folderMatch = body.match(
                /name="folderId"\r?\n\r?\n([^\r\n]+)/
            );
            const name = nameMatch?.[1] ?? 'upload.bin';
            const id = nextAssetId();
            const created = asset({
                id,
                name,
                folderId: folderMatch?.[1] ?? null,
                kind: /\.(png|jpe?g|gif|webp)$/i.test(name)
                    ? 'image'
                    : 'document',
                mimeType: /\.png$/i.test(name)
                    ? 'image/png'
                    : 'application/octet-stream'
            });
            assets.unshift(created);
            await route.fulfill(json(created, 201));
            return;
        }
        if (method === 'DELETE') {
            const { ids } = request.postDataJSON() as { ids: string[] };
            const drop = new Set(ids);
            for (let i = assets.length - 1; i >= 0; i -= 1) {
                if (drop.has(assets[i].id)) assets.splice(i, 1);
            }
            await route.fulfill(json({ deleted: ids.length }));
            return;
        }
        await route.fallback();
    });

    // PATCH a single asset (rename / move / retag / alt).
    await page.route(
        /\/api\/media\/assets\/([^/?]+)(\?.*)?$/,
        async (route) => {
            if (route.request().method() !== 'PATCH') return route.fallback();
            const id = segments(route.request().url())[4];
            const found = assets.find((a) => a.id === id);
            if (found) {
                const patch = route
                    .request()
                    .postDataJSON() as Partial<AssetResponse>;
                Object.assign(found, patch);
            }
            await route.fulfill(json(found ?? {}, found ? 200 : 404));
        }
    );

    // Duplicate an asset.
    await page.route(
        /\/api\/media\/assets\/([^/?]+)\/duplicate(\?.*)?$/,
        async (route) => {
            const id = segments(route.request().url())[4];
            const source = assets.find((a) => a.id === id);
            if (!source) {
                await route.fulfill(json({ message: 'Not found' }, 404));
                return;
            }
            const dot = source.name.lastIndexOf('.');
            const name =
                dot > 0
                    ? `${source.name.slice(0, dot)} copy${source.name.slice(dot)}`
                    : `${source.name} copy`;
            const copy = asset({ ...source, id: nextAssetId(), name });
            assets.unshift(copy);
            await route.fulfill(json(copy, 201));
        }
    );

    // The byte route — a 1px PNG so image tiles load.
    await page.route(
        /\/api\/media\/assets\/([^/?]+)\/raw(\?.*)?$/,
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: PNG_1PX
            });
        }
    );

    return {
        get count() {
            return uploads;
        }
    };
}
