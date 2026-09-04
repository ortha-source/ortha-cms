import { Asset } from './asset';
import { AssetId } from './value-objects/asset-id';
import { FileName } from './value-objects/file-name';
import { MediaKind } from './value-objects/media-kind';
import { StorageKey } from './value-objects/storage-key';

/**
 * Alt text has two write paths — `Asset.create`, behind both upload routes, and
 * `Asset.setAlt`, behind `PATCH /media/assets/:id` and the copilot's alt-text
 * applier — and they must normalize identically.
 *
 * The consequence of a drift is not cosmetic. The alt-coverage insight counts
 * an image as described when `length(trim(alt)) > 0`, so a path that stored
 * `'   '` verbatim would report accessibility work as done that nobody has
 * done, on exactly the images someone skipped. `' '` is also the markup for
 * "decorative", which is a claim about the image nobody made.
 *
 * The insight's own e2e (`media-insights.spec.ts`) seeds rows straight into the
 * table, so it pins the *counting* rule and never reaches either writer. This
 * is the writers.
 */
describe('Asset alt text', () => {
    const newAsset = (alt?: string | null) =>
        Asset.create({
            id: AssetId.generate(),
            workspaceId: 'ws-1',
            folderId: null,
            name: FileName.create('hero.png'),
            storageKey: StorageKey.create('ws-1/hero.png'),
            storageProvider: 'local',
            kind: MediaKind.fromMime('image/png'),
            mimeType: 'image/png',
            size: 1024,
            checksum: null,
            uploadedBy: 'user-1',
            ...(alt === undefined ? {} : { alt })
        });

    /** Values that mean "nobody described this", however they are spelled. */
    const BLANK = [
        ['an omitted value', undefined],
        ['an explicit null', null],
        ['an empty string', ''],
        ['spaces', '   '],
        ['a tab and a newline', '\t\n']
    ] as const;

    // covers: media:I-25
    it.each(BLANK)('is null on upload for %s', (_label, value) => {
        expect(newAsset(value).alt).toBeNull();
    });

    // covers: media:I-25
    it.each(BLANK)('is null after an update with %s', (_label, value) => {
        const asset = newAsset('A hero image');

        asset.setAlt(value ?? null);

        expect(asset.alt).toBeNull();
    });

    // covers: media:I-25
    it('is trimmed rather than rejected on both paths', () => {
        // The positive control: the two cases above would both pass against a
        // writer that stored `null` for everything.
        expect(newAsset('  A hero image  ').alt).toBe('A hero image');

        const asset = newAsset(null);
        asset.setAlt('  A hero image  ');
        expect(asset.alt).toBe('A hero image');
    });

    it('says nothing changed when the trim lands on the value it already had', () => {
        const asset = Asset.rehydrate({
            id: AssetId.generate().value,
            workspaceId: 'ws-1',
            folderId: null,
            name: 'hero.png',
            storageKey: 'ws-1/hero.png',
            storageProvider: 'local',
            kind: 'image',
            mimeType: 'image/png',
            size: 1024,
            checksum: null,
            width: null,
            height: null,
            duration: null,
            variants: {},
            tags: [],
            alt: 'A hero image',
            tracks: [],
            uploadedBy: 'user-1'
        });

        asset.setAlt('  A hero image  ');

        // Normalization happens before the idempotence check, so a re-save of
        // the same description with a stray space raises no event and writes
        // no audit row.
        expect(asset.pullEvents()).toEqual([]);
    });
});
