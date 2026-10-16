/**
 * The media library of `main`: one asset per kind the library treats
 * differently, two levels of folders, and an orphan nothing links to.
 *
 * Uploaded through `UploadAssetUseCase`, so blobs land in the configured
 * provider (`MEDIA_LOCAL_ROOT`, `./.storage/media` by default) and images get
 * their thumb/preview derivatives — the e2e helper writes rows against the
 * memory provider, which the boot check would refuse here.
 *
 * Raster images are drawn by Sharp at seed time rather than committed; the
 * video, audio, PDF, archive, SVG and caption files live in `../assets/`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { UploadAssetUseCase } from '@orthacms/media-server';
import { CreateFolderUseCase } from '../../../../../packages/media/server/src/lib/application/use-cases/create-folder.use-case';
import { UpdateAssetUseCase } from '../../../../../packages/media/server/src/lib/application/use-cases/update-asset.use-case';
import type { SeedContext } from '../context';

const ASSETS = join(__dirname, '../dev/seed/assets');

/** A labelled gradient: enough to tell the images apart in the library. */
async function drawImage(
    label: string,
    from: string,
    to: string,
    format: 'jpeg' | 'png',
    width = 1600,
    height = 900
): Promise<Buffer> {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
        </linearGradient></defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="50%" y="54%" font-family="sans-serif" font-size="${Math.round(height / 8)}" font-weight="700" text-anchor="middle" fill="#fff">${label}</text>
    </svg>`;
    const image = sharp(Buffer.from(svg));
    return format === 'jpeg'
        ? image.jpeg({ quality: 80 }).toBuffer()
        : image.png().toBuffer();
}

export async function seedMedia(ctx: SeedContext): Promise<void> {
    const upload = ctx.get(UploadAssetUseCase);
    const folders = ctx.get(CreateFolderUseCase);
    const update = ctx.get(UpdateAssetUseCase);
    const admin = ctx.user('admin');
    const actor = ctx.actor('admin');
    const workspaceId = ctx.workspace('main').id;

    const brand = await folders.execute({ workspaceId, name: 'Brand' }, admin);
    const logos = await folders.execute(
        { workspaceId, name: 'Logos', parentId: brand },
        admin
    );
    const documents = await folders.execute(
        { workspaceId, name: 'Documents' },
        admin
    );
    const video = await folders.execute(
        { workspaceId, name: 'Video & audio' },
        admin
    );

    const put = async (
        key: string,
        fileName: string,
        contentType: string,
        body: Buffer,
        folderId: string | null,
        alt?: string
    ) => {
        const id = await upload.execute(
            {
                workspaceId,
                folderId,
                fileName,
                contentType,
                body: Readable.from(body),
                alt: alt ?? null
            },
            actor
        );
        ctx.media.set(key, id);
        return id;
    };
    const file = (name: string) => readFileSync(join(ASSETS, name));

    await put(
        'hero',
        'hero.jpg',
        'image/jpeg',
        await drawImage('Hero', '#6d28d9', '#db2777', 'jpeg'),
        brand,
        'A violet-to-pink gradient labelled "Hero".'
    );
    await put(
        'photo_no_alt',
        'photo-without-alt.jpg',
        'image/jpeg',
        await drawImage('No alt', '#0f766e', '#22c55e', 'jpeg'),
        null
    );
    await put(
        'divider',
        'divider.png',
        'image/png',
        await drawImage('Decorative', '#64748b', '#cbd5e1', 'png', 1200, 200),
        brand
    );
    await put(
        'gallery_1',
        'gallery-1.jpg',
        'image/jpeg',
        await drawImage('Gallery 1', '#1d4ed8', '#38bdf8', 'jpeg', 1200, 800),
        null,
        'Gallery image one.'
    );
    await put(
        'gallery_2',
        'gallery-2.jpg',
        'image/jpeg',
        await drawImage('Gallery 2', '#b45309', '#facc15', 'jpeg', 1200, 800),
        null,
        'Gallery image two.'
    );
    await put(
        'small',
        'tiny.png',
        'image/png',
        await drawImage('S', '#111827', '#374151', 'png', 64, 64),
        null,
        'A tiny image: too small for derivatives.'
    );
    await put(
        'logo',
        'logo.svg',
        'image/svg+xml',
        file('sample-logo.svg'),
        logos,
        'The Ortha "O" mark.'
    );
    await put(
        'pdf',
        'sample-document.pdf',
        'application/pdf',
        file('sample-document.pdf'),
        documents
    );
    await put(
        'zip',
        'sample-archive.zip',
        'application/zip',
        file('sample-archive.zip'),
        documents
    );
    const videoId = await put(
        'video',
        'sample-video.mp4',
        'video/mp4',
        file('sample-video.mp4'),
        video
    );
    const captions = await put(
        'captions',
        'sample-captions.vtt',
        'text/vtt',
        file('sample-captions.vtt'),
        video
    );
    await put(
        'audio',
        'sample-audio.mp3',
        'audio/mpeg',
        file('sample-audio.mp3'),
        video
    );
    await put(
        'orphan',
        'orphan.jpg',
        'image/jpeg',
        await drawImage('Orphan', '#7f1d1d', '#f87171', 'jpeg', 800, 600),
        null,
        'Linked from nothing.'
    );

    await update.execute(
        videoId,
        workspaceId,
        {
            tags: ['demo', 'captioned'],
            tracks: [
                {
                    kind: 'captions',
                    srclang: 'en',
                    label: 'English',
                    assetId: captions
                }
            ]
        },
        actor
    );
    await update.execute(
        ctx.asset('hero'),
        workspaceId,
        { tags: ['brand', 'hero'] },
        actor
    );

    ctx.section('Media (Main)', [
        'Folders: Brand › Logos, Documents, Video & audio.',
        '',
        '- `hero.jpg` — with alt, tagged; `photo-without-alt.jpg` — no alt (shows in the alt-coverage insight)',
        '- `divider.png` — used decoratively by a `field_media` entry; `tiny.png` — too small for derivatives',
        '- `logo.svg` (no raster derivatives), `sample-document.pdf`, `sample-archive.zip`',
        '- `sample-video.mp4` with an English caption track, `sample-audio.mp3`',
        '- `orphan.jpg` — linked from nothing'
    ]);
}
