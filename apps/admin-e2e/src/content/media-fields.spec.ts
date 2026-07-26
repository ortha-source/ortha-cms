import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    MEDIA_FIELDS_WORKSPACE,
    MEDIA_FIELDS_SCHEMA_SEED,
    MEDIA_FIELDS_DETAIL_SEED,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockContentEntryRead,
    mockEntryMedia,
    spyEntrySave,
    type EntrySaveSpy
} from '../support/api/content';
import {
    mockMediaApi,
    uploadedAssetId,
    MEDIA_ASSET_IDS,
    type MediaUploadSpy
} from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

const WS = MEDIA_FIELDS_WORKSPACE.id;

/**
 * The entry editor's **Media tab** (`@ortha-cms/media-admin`, contributed
 * through content-admin's `ENTRY_TAB_SLOT`): attaching an asset from the Media
 * Library, staging an upload that only goes up **with the record**, removing and
 * reordering, and accessibility. Both backends are mocked — the content schema /
 * save endpoints and the real media endpoints the picker and upload drive.
 */
test.describe('Entry editor — Media tab', () => {
    let uploads: MediaUploadSpy;
    let saves: EntrySaveSpy;

    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [MEDIA_FIELDS_WORKSPACE]);
        await mockContentSchema(page, { types: MEDIA_FIELDS_SCHEMA_SEED });
        await mockContentSchemaDetail(page, {
            details: MEDIA_FIELDS_DETAIL_SEED
        });
        await mockContentEntries(page, {
            details: MEDIA_FIELDS_DETAIL_SEED,
            entries: { article: [] }
        });
        await mockContentEntryWrites(page, {
            details: MEDIA_FIELDS_DETAIL_SEED
        });
        // After the write mock, whose multi-segment route would otherwise answer
        // `/:id/media` with an entry record.
        await mockEntryMedia(page);
        uploads = await mockMediaApi(page);
        saves = await spyEntrySave(page);
    });

    test('renders a card per media field, each with its empty state', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.openMediaTab();

        await expect(mediaFieldPage.section('Cover image')).toBeVisible();
        await expect(mediaFieldPage.section('Gallery')).toBeVisible();
        // The two shapes read differently, and say what a drop would do.
        await expect(mediaFieldPage.emptySingle).toBeVisible();
        await expect(mediaFieldPage.emptyMultiple).toBeVisible();
        await expect(
            mediaFieldPage.libraryButton('Select from library')
        ).toBeVisible();
        await expect(
            mediaFieldPage.libraryButton('Add from library')
        ).toBeVisible();
    });

    test('attaches an asset picked from the library and saves its id', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.title.fill('A record');
        await mediaFieldPage.openMediaTab();

        await mediaFieldPage.libraryButton('Select from library').click();
        await expect(mediaFieldPage.pickerDialog).toBeVisible();
        await mediaFieldPage.pickAsset('hero.png');

        await expect(mediaFieldPage.pickerDialog).toBeHidden();
        // The tile shows the asset, and the trigger now offers a replacement.
        await expect(mediaFieldPage.removeAsset('hero.png')).toBeVisible();
        await expect(mediaFieldPage.libraryButton('Replace')).toBeVisible();
        // Picking an existing asset uploads nothing — it is already in the
        // library; only its id joins the record.
        expect(uploads.count).toBe(0);

        await mediaFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(saves.bodies[0].values.cover).toBe(MEDIA_ASSET_IDS.hero);
    });

    test('restricts the picker to the kinds the field accepts', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.openMediaTab();

        // `cover` accepts images only, so the seeded PDF is not a candidate.
        await mediaFieldPage.libraryButton('Select from library').click();
        await expect(mediaFieldPage.pickerTile('hero.png')).toBeVisible();
        await expect(mediaFieldPage.pickerTile('report.pdf')).toBeHidden();
    });

    test('walks into a folder and back out through the breadcrumb', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.openMediaTab();

        await mediaFieldPage.libraryButton('Add from library').click();
        await mediaFieldPage.pickerFolder('Images').click();
        // Inside the folder: its asset, not the root's.
        await expect(mediaFieldPage.pickerTile('inside.png')).toBeVisible();
        await expect(mediaFieldPage.pickerTile('hero.png')).toBeHidden();
        // Descending used to be one-way; the breadcrumb is the way back.
        await mediaFieldPage.pickerRootCrumb.click();
        await expect(mediaFieldPage.pickerTile('hero.png')).toBeVisible();
    });

    test('stages an upload and sends it only when the record is saved', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.title.fill('A record');
        await mediaFieldPage.openMediaTab();

        await mediaFieldPage.stageUpload('Cover image', 'new-cover.png');

        // Staged, not uploaded: the tile says so and no request has gone out.
        await expect(mediaFieldPage.pendingMarker).toBeVisible();
        await expect(mediaFieldPage.pendingCount).toBeVisible();
        expect(uploads.count).toBe(0);

        await mediaFieldPage.save.click();

        // The save uploads it first, then writes the record with the new id.
        await expect.poll(() => uploads.count).toBe(1);
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(saves.bodies[0].values.cover).toBe(uploadedAssetId(1));
    });

    test('drops a staged file without ever uploading it', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.title.fill('A record');
        await mediaFieldPage.openMediaTab();

        await mediaFieldPage.stageUpload('Gallery', 'scrap.png');
        await expect(mediaFieldPage.removeAsset('scrap.png')).toBeVisible();

        await mediaFieldPage.removeAsset('scrap.png').click();
        await expect(mediaFieldPage.emptyMultiple).toBeVisible();

        await mediaFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        // Abandoned before the save, so it never reached the library.
        expect(uploads.count).toBe(0);
        expect(saves.bodies[0].values.gallery).toEqual([]);
    });

    test('appends to a multiple field and reorders it', async ({
        mediaFieldPage
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.title.fill('A record');
        await mediaFieldPage.openMediaTab();

        await mediaFieldPage.libraryButton('Add from library').click();
        await mediaFieldPage.pickerTile('hero.png').click();
        await mediaFieldPage.pickerTile('report.pdf').click();
        await mediaFieldPage.pickerConfirm.click();

        expect(await mediaFieldPage.attachedNames('Gallery')).toEqual([
            'hero.png',
            'report.pdf'
        ]);

        // The order is the delivered order, so it has to be editable.
        await mediaFieldPage.moveAssetDown('hero.png').click();
        expect(await mediaFieldPage.attachedNames('Gallery')).toEqual([
            'report.pdf',
            'hero.png'
        ]);

        await mediaFieldPage.save.click();
        await expect.poll(() => saves.bodies.length).toBeGreaterThan(0);
        expect(saves.bodies[0].values.gallery).toEqual([
            MEDIA_ASSET_IDS.report,
            MEDIA_ASSET_IDS.hero
        ]);
    });

    test('shows a saved record’s assets by name, not by id', async ({
        page,
        mediaFieldPage
    }) => {
        // A saved record stores ids; the editor resolves them through
        // `GET /:id/media`, which is what keeps a uuid off the screen.
        await mockContentEntryRead(page, {
            records: {
                'article/article-1': {
                    text: 'Saved',
                    cover: MEDIA_ASSET_IDS.hero
                }
            }
        });
        await mockEntryMedia(page, {
            media: {
                'article/article-1': {
                    cover: [
                        {
                            id: MEDIA_ASSET_IDS.hero,
                            name: 'hero.png',
                            url: `/api/media/assets/${MEDIA_ASSET_IDS.hero}/raw`,
                            kind: 'image',
                            mimeType: 'image/png'
                        }
                    ]
                }
            }
        });
        await mediaFieldPage.gotoArticle(WS, 'article-1');
        await mediaFieldPage.openMediaTab();

        await expect(mediaFieldPage.removeAsset('hero.png')).toBeVisible();
    });

    test('has no accessibility violations, picker included', async ({
        mediaFieldPage,
        makeAxe
    }) => {
        await mediaFieldPage.gotoNewArticle(WS);
        await mediaFieldPage.openMediaTab();
        await expect(mediaFieldPage.emptySingle).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        // And with an asset attached + the picker open (the dynamic states).
        await mediaFieldPage.libraryButton('Add from library').click();
        await expect(mediaFieldPage.pickerDialog).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });
});
