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
/**
 * The alt text {@link MEDIA_ASSET_IDS.hero} carries in the library. Seeded so a
 * suite can prove alt written once in the library isn't written again per body.
 */
export const MEDIA_HERO_ALT = 'The team at the launch';

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
            height: 800,
            alt: MEDIA_HERO_ALT
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
    /**
     * The `alt` part of each upload, in order — `null` when the request carried
     * none. Lets a spec prove a description typed at staging actually reached
     * the wire, rather than only that an input existed.
     */
    readonly alts: (string | null)[];
}

/** Knobs for the upload route, so a spec can drive its slow and failed paths. */
export interface MockMediaOptions {
    /**
     * Hold each upload open this long before answering. The composer blocks
     * send while one is in flight, and without a delay the upload resolves
     * before a test can observe the blocked state at all.
     */
    uploadDelayMs?: number;
    /** Answer uploads with this status instead of 201, e.g. 413 for too-large. */
    uploadStatus?: number;
}

/**
 * Fail every media **read** (`/api/media/folders`, `/api/media/assets`) with a
 * 500. Register **after** {@link mockMediaApi} so it wins the match — for
 * asserting that a surface distinguishes "couldn't load" from "nothing here".
 */
export async function failMediaReads(page: Page): Promise<void> {
    await page.route(
        /\/api\/media\/(folders|assets)(\?.*)?$/,
        async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            await route.fulfill(json({ message: 'Server error' }, 500));
        }
    );
}

/**
 * Stub the media API with a **stateful** in-memory store, so a spec can drive
 * the full Media Library against a deterministic backend: folders + assets read,
 * multipart upload (parses the filename from the body), create/rename/delete
 * folder (409 when non-empty), patch/duplicate/bulk-delete assets, and the
 * `/raw` byte route (a 1px PNG). Returns an upload spy.
 */
export async function mockMediaApi(
    page: Page,
    options: MockMediaOptions = {}
): Promise<MediaUploadSpy> {
    const folders = MEDIA_SEED.folders.map((f) => ({ ...f }));
    const assets = MEDIA_SEED.assets.map((a) => ({ ...a }));
    const uploadAlts: (string | null)[] = [];
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
                // Deleting a folder takes its whole subtree with it, as the
                // server does — a non-empty folder is no longer a 409.
                const doomed = new Set<string>([id]);
                for (let added = true; added; ) {
                    added = false;
                    for (const folder of folders) {
                        if (
                            folder.parentId &&
                            doomed.has(folder.parentId) &&
                            !doomed.has(folder.id)
                        ) {
                            doomed.add(folder.id);
                            added = true;
                        }
                    }
                }
                for (let i = folders.length - 1; i >= 0; i -= 1) {
                    if (doomed.has(folders[i].id)) folders.splice(i, 1);
                }
                for (let i = assets.length - 1; i >= 0; i -= 1) {
                    const folderId = assets[i].folderId;
                    if (folderId && doomed.has(folderId)) assets.splice(i, 1);
                }
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
            const params = new URL(request.url()).searchParams;
            const folderId = params.get('folderId');
            const search = params.get('search')?.trim().toLowerCase() ?? '';
            const kind = params.get('kind');
            const sort = params.get('sort') ?? 'newest';
            const page = Number(params.get('page') ?? '1');
            const pageSize = Number(params.get('pageSize') ?? '24');

            // The browse controls are the **server's** now — the admin sends
            // search/kind/sort/page and draws whatever comes back, with no
            // filtering of its own left to paper over a mock that ignores them.
            // So this has to answer like the real query does, or the suite
            // would be proving the UI works against a backend that does not.
            const matched = assets
                .filter((a) =>
                    folderId ? a.folderId === folderId : a.folderId === null
                )
                .filter((a) => !kind || kind === 'all' || a.kind === kind)
                // Name **or** tag, matching the server's own search.
                .filter(
                    (a) =>
                        a.name.toLowerCase().includes(search) ||
                        (a.tags ?? []).some((tag) =>
                            tag.toLowerCase().includes(search)
                        )
                );

            const sorted = [...matched].sort((a, b) => {
                switch (sort) {
                    case 'name-asc':
                        return a.name.localeCompare(b.name);
                    case 'name-desc':
                        return b.name.localeCompare(a.name);
                    case 'oldest':
                        return a.createdAt.localeCompare(b.createdAt);
                    case 'largest':
                        return b.size - a.size;
                    case 'smallest':
                        return a.size - b.size;
                    default:
                        return b.createdAt.localeCompare(a.createdAt);
                }
            });

            const start = (page - 1) * pageSize;
            await route.fulfill(
                json({
                    items: sorted.slice(start, start + pageSize),
                    total: sorted.length,
                    page,
                    pageSize
                })
            );
            return;
        }
        if (method === 'POST') {
            uploads += 1;
            const submitted = request.postData() ?? '';
            uploadAlts.push(
                submitted.match(/name="alt"\r?\n\r?\n([^\r\n]*)/)?.[1] ?? null
            );
            if (options.uploadDelayMs) {
                await new Promise((resolve) =>
                    setTimeout(resolve, options.uploadDelayMs)
                );
            }
            if (options.uploadStatus) {
                await route.fulfill(
                    json(
                        { message: 'That file is too large to upload.' },
                        options.uploadStatus
                    )
                );
                return;
            }
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
        },
        get alts() {
            return [...uploadAlts];
        }
    };
}

/**
 * Fail every single-asset `PATCH` (rename / move / alt) with `status` and a
 * server-worded body. Register **after** {@link mockMediaApi} so it wins the
 * match — for asserting that the API's own sentence reaches the user, and that
 * no success confirmation fires alongside it.
 */
export async function failAssetPatch(
    page: Page,
    { status = 400, message = 'Invalid file name: a/b.txt' } = {}
): Promise<void> {
    await page.route(
        /\/api\/media\/assets\/([^/?]+)(\?.*)?$/,
        async (route) => {
            if (route.request().method() !== 'PATCH') return route.fallback();
            await route.fulfill(
                json(
                    { message, error: 'Bad Request', statusCode: status },
                    status
                )
            );
        }
    );
}
