import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockSchemaDocument,
    SCHEMA_TYPES_SEED,
    type TypeDocSeed
} from '../support/api/schemaBuilder';
import { expectNoA11yViolations } from '../support/a11y';

const EDITABLE = { editable: true, restart: 'watch' } as const;

/**
 * The seed with every type handed to the builder, plus one with two inputs of
 * one rank, one with a group holding a field and a group holding none, and
 * one whose second group is far taller than its first.
 */
const OWNED: TypeDocSeed[] = [
    ...SCHEMA_TYPES_SEED.map((type) => ({
        ...type,
        origin: 'builder' as const
    })),
    {
        name: 'venue',
        kind: 'collection',
        label: 'Venues',
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [
            { key: 'venue.name', name: 'name', spec: { type: 'text' } },
            { key: 'venue.city', name: 'city', spec: { type: 'text' } },
            { key: 'venue.open', name: 'open', spec: { type: 'boolean' } }
        ],
        origin: 'builder'
    },
    {
        name: 'place',
        kind: 'collection',
        label: 'Places',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [
            { key: 'location', label: 'Location' },
            { key: 'extra', label: 'Extra' }
        ],
        fields: [
            { key: 'place.name', name: 'name', spec: { type: 'text' } },
            {
                key: 'place.city',
                name: 'city',
                spec: { type: 'text', admin: { group: 'location' } }
            },
            { key: 'place.open', name: 'open', spec: { type: 'boolean' } }
        ],
        origin: 'builder'
    },
    {
        name: 'trip',
        kind: 'collection',
        label: 'Trips',
        publishable: false,
        paranoid: false,
        i18n: false,
        groups: [
            { key: 'dates', label: 'Dates' },
            { key: 'itinerary', label: 'Itinerary' }
        ],
        fields: [
            { key: 'trip.name', name: 'name', spec: { type: 'text' } },
            {
                key: 'trip.start',
                name: 'start',
                spec: { type: 'text', admin: { group: 'dates' } }
            },
            ...['from', 'to', 'via', 'stops', 'carrier', 'notes'].map(
                (name) => ({
                    key: `trip.${name}`,
                    name,
                    spec: { type: 'text', admin: { group: 'itinerary' } }
                })
            )
        ],
        origin: 'builder'
    }
];

/**
 * The content model editor (`@orthacms/schema-builder-admin`, ADR-0020):
 * every edit goes into the draft at once; the header counts it, the rail
 * marks it, Discard puts it back. Only types the builder owns are editable.
 */
test.describe('Content model editor', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
        await mockSchemaDocument(page, {
            types: OWNED,
            capabilities: EDITABLE
        });
    });

    test('adds a field: the kind in a dialog by keyboard, then its panel — the name from the label, a live preview, the rules', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        const kinds = contentModelPage.addFieldDialog();
        await expect(kinds).toHaveAccessibleName('Add a field to Articles');

        await contentModelPage.fieldKind('Short text').focus();
        await page.keyboard.press('ArrowRight');
        await expect(contentModelPage.fieldKind('Long text')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(contentModelPage.fieldKind('Long text')).toBeFocused();
        await page.keyboard.press('Enter');

        await contentModelPage
            .newFieldSheet()
            .getByLabel('Label')
            .fill('Summary text');
        // The panel is named by the field now, and previews it as editors see it.
        const panel = contentModelPage.fieldSheet('Summary text');
        await expect(panel.getByLabel('Machine name')).toHaveValue(
            'summaryText'
        );
        await expect(
            panel.getByRole('region', { name: 'Preview — how editors see it' })
        ).toContainText('Summary text');
        await expect(
            panel.getByRole('tab', { name: 'Validation' })
        ).toBeVisible();
        await expect(contentModelPage.changeCount()).toBeHidden();
        await panel.getByRole('button', { name: 'Add field' }).click();

        await expect(contentModelPage.changeCount()).toHaveText(
            '1 unsaved change'
        );
        await expect(contentModelPage.editField('summaryText')).toBeVisible();
    });

    test('finds a kind of field by what it holds', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await contentModelPage
            .addFieldDialog()
            .getByRole('searchbox')
            .fill('image');
        await expect(
            contentModelPage.addFieldDialog().getByRole('radio')
        ).toHaveCount(1);
        await expect(contentModelPage.fieldKind('Media')).toBeVisible();
        // Enter picks the one left.
        await page.keyboard.press('Enter');
        await expect(contentModelPage.newFieldSheet()).toContainText('Media');
    });

    test('a relation is asked what it links to and how many, as roomy cards', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await contentModelPage.fieldKind('Relation').click();
        await contentModelPage.reviewAction('Continue').click();

        const howMany = page.getByRole('group', { name: 'How many' });
        // Named the usual way, and each said with both types' names.
        await expect(howMany.getByRole('radio')).toHaveCount(3);
        for (const name of ['Many-to-one', 'One-to-one', 'Many-to-many']) {
            await expect(howMany.getByRole('radio', { name })).toBeVisible();
        }
        await expect(
            howMany.getByRole('radio', { name: 'Many-to-many' })
        ).toHaveAccessibleDescription(
            /Each entry in Articles links to any number of entries in Articles.*join table/
        );
        // The whole card picks the answer, not just the dot.
        await howMany
            .getByText('Like a product and its spec sheet.', {
                exact: false
            })
            .click();
        await expect(
            howMany.getByRole('radio', { name: 'One-to-one' })
        ).toBeChecked();
    });

    test('leaving the new field’s panel keeps nothing half-made', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await contentModelPage.reviewAction('Continue').click();
        await contentModelPage
            .newFieldSheet()
            .getByLabel('Label')
            .fill('Subtitle');
        await page.keyboard.press('Escape');
        await expect(contentModelPage.newFieldSheet()).toBeHidden();
        await expect(contentModelPage.fieldSheet('Subtitle')).toBeHidden();
        await expect(contentModelPage.changeCount()).toBeHidden();
        await expect(contentModelPage.editField('subtitle')).toHaveCount(0);
    });

    test('edits validation in the sheet, with a preset and a live tester', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.editField('title').click();
        const sheet = contentModelPage.fieldSheet('title');
        await sheet.getByRole('tab', { name: 'Validation' }).click();
        await sheet.getByRole('button', { name: 'Slug' }).click();
        await sheet.getByLabel('Try a value').fill('hello-world');
        await expect(
            sheet.getByRole('status').filter({ hasText: 'Matches' })
        ).toBeVisible();
        await sheet.getByLabel('Try a value').fill('Hello World');
        await expect(sheet.getByText('Does not match')).toBeVisible();
    });

    test('typing in a select’s option keeps the focus — every keystroke lands', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.editField('kind').click();
        const sheet = contentModelPage.fieldSheet('kind');

        const first = contentModelPage.selectOption(sheet, 1);
        await first.click();
        await first.press('End');
        await first.pressSequentially('-flash');
        await expect(first).toBeFocused();
        await expect(first).toHaveValue('news-flash');

        await first.press('ControlOrMeta+A');
        await first.press('Backspace');
        await first.pressSequentially('FOOD');
        await expect(first).toBeFocused();
        await expect(first).toHaveValue('FOOD');
        await expect(contentModelPage.selectOption(sheet, 2)).toHaveValue(
            'opinion'
        );
    });

    test('a select’s options stay editable after one is added and one removed', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.editField('kind').click();
        const sheet = contentModelPage.fieldSheet('kind');

        const fresh = contentModelPage.newSelectOption(sheet);
        await fresh.fill('review');
        await fresh.press('Enter');
        await expect(fresh).toBeFocused();
        await expect(fresh).toHaveValue('');
        await expect(contentModelPage.selectOption(sheet, 3)).toHaveValue(
            'review'
        );

        await contentModelPage.removeSelectOption(sheet, 'news').click();
        await expect(contentModelPage.selectOption(sheet, 1)).toHaveValue(
            'opinion'
        );
        await expect(contentModelPage.selectOption(sheet, 2)).toHaveValue(
            'review'
        );
        await expect(contentModelPage.selectOption(sheet, 3)).toHaveCount(0);

        const last = contentModelPage.selectOption(sheet, 2);
        await last.click();
        await last.press('End');
        await last.pressSequentially('ed');
        await expect(last).toBeFocused();
        await expect(last).toHaveValue('reviewed');
        await expect(contentModelPage.selectOption(sheet, 1)).toHaveValue(
            'opinion'
        );
        await expect(contentModelPage.changeCount()).toBeVisible();
    });

    test('a select’s options sit above its default, which follows a rename', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.editField('kind').click();
        const sheet = contentModelPage.fieldSheet('kind');
        // Options are a basic now: no Validation tab for a select.
        await expect(
            sheet.getByRole('tab', { name: 'Validation' })
        ).toHaveCount(0);
        await sheet.getByLabel('Default value').click();
        await contentModelPage.option('news').click();
        await expect(sheet.getByLabel('Default value')).toContainText('news');

        const first = contentModelPage.selectOption(sheet, 1);
        await first.click();
        await first.press('End');
        await first.pressSequentially('-flash');
        await expect(sheet.getByLabel('Default value')).toContainText(
            'news-flash'
        );

        await contentModelPage.removeSelectOption(sheet, 'news-flash').click();
        await expect(sheet.getByLabel('Default value')).toContainText(
            'No default'
        );
    });

    test('adding a select asks for its options in the panel, then a default from them', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await contentModelPage.fieldKind('One of a list').click();
        await contentModelPage.reviewAction('Continue').click();

        const sheet = contentModelPage.newFieldSheet();
        await sheet.getByLabel('Label').fill('Stage');
        const panel = contentModelPage.fieldSheet('Stage');
        const fresh = panel.getByRole('textbox', { name: 'New option' });
        await fresh.fill('draft');
        await fresh.press('Enter');
        await fresh.fill('final');
        await fresh.press('Enter');
        await panel.getByLabel('Default value').click();
        await contentModelPage.option('final').click();
        await expect(panel.getByLabel('Default value')).toContainText('final');
        // The preview shows the default the form will start from.
        await expect(
            panel.getByRole('region', { name: 'Preview — how editors see it' })
        ).toContainText('final');

        await expect(
            panel.getByRole('tab', { name: 'Validation' })
        ).toHaveCount(0);
        await panel.getByRole('button', { name: 'Add field' }).click();
        await expect(contentModelPage.editField('stage')).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('reorders within one rank by keyboard, and refuses a move across ranks', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('venue');
        await expect
            .poll(() => contentModelPage.fieldNames())
            .toEqual(['name', 'city', 'open']);

        await contentModelPage.moveFieldUp('city');
        await expect
            .poll(() => contentModelPage.fieldNames())
            .toEqual(['city', 'name', 'open']);

        // A boolean is a choice, ranked after inputs: the editor would put it back.
        await contentModelPage.moveFieldUp('open');
        await expect(
            contentModelPage.announcement(/open stays where it is/)
        ).toBeAttached();
        await expect
            .poll(() => contentModelPage.fieldNames())
            .toEqual(['city', 'name', 'open']);
    });

    test('adds a group on General and puts a field in it', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('venue');
        await contentModelPage.groupsButton().click();
        const sheet = contentModelPage.groupsSheet();
        await sheet.getByLabel('New group title').fill('Location');
        await sheet.getByRole('button', { name: 'Add group' }).click();
        await expect(
            sheet.getByText(/the schema refuses an empty group/)
        ).toBeVisible();
        await sheet.getByRole('button', { name: 'Done' }).click();

        await contentModelPage.editField('city').click();
        const field = contentModelPage.fieldSheet('city');
        await field.getByRole('tab', { name: 'Display' }).click();
        await field.getByLabel('Group on the Content tab').click();
        await contentModelPage.option('Location').click();
        await field.getByRole('button', { name: 'Done' }).click();

        await expect(contentModelPage.groupTrigger('Location')).toBeVisible();
    });

    test.describe('groups by drag and drop', () => {
        test('drags a field into a group, before the field it is dropped on', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['name', 'open', 'city']);

            await contentModelPage.dragField(
                'name',
                contentModelPage.fieldRow('city')
            );

            await expect(
                contentModelPage.announcement(
                    /^Moved name to the group Location\.$/
                )
            ).toBeAttached();
            await expect(
                contentModelPage.groupTrigger('Location')
            ).toContainText('2 fields');
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['open', 'name', 'city']);
            await expect(contentModelPage.changeCount()).toBeVisible();

            // The field's own Display tab says the same.
            await contentModelPage.editField('name').click();
            const sheet = contentModelPage.fieldSheet('name');
            await sheet.getByRole('tab', { name: 'Display' }).click();
            await expect(
                sheet.getByLabel('Group on the Content tab')
            ).toContainText('Location');
        });

        test('drags a field into a group with no fields', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.dragField(
                'open',
                contentModelPage.emptyGroupDropZone('Extra')
            );

            await expect(contentModelPage.groupTrigger('Extra')).toContainText(
                '1 field'
            );
            await expect(
                contentModelPage.emptyGroupDropZone('Extra')
            ).toHaveCount(0);
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['name', 'city', 'open']);
        });

        test('drags a field out of its group, back to the loose fields', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.dragField(
                'city',
                contentModelPage.fieldRow('name')
            );

            await expect(
                contentModelPage.announcement(
                    /^Moved city to the fields above the groups\.$/
                )
            ).toBeAttached();
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['city', 'name', 'open']);
            // The group it left is empty now, and says so.
            await expect(
                contentModelPage.emptyGroupDropZone('Location')
            ).toBeVisible();
        });

        test('makes room in the group while the field is still held', async ({
            page,
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.startDrag(
                contentModelPage.reorderHandle('name'),
                contentModelPage.fieldRow('name'),
                contentModelPage.fieldRow('city')
            );
            // Not dropped yet — and already a row of the group.
            await expect
                .poll(() => contentModelPage.groupFieldNames('Location'))
                .toContain('name');
            await page.mouse.up();
            await expect(
                contentModelPage.groupTrigger('Location')
            ).toContainText('2 fields');
        });

        test('moves a field into a group by keyboard', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.moveFieldByKeyboard(
                'open',
                'ArrowDown',
                /^open is over city, in the group Location\.$/
            );

            await expect(
                contentModelPage.announcement(
                    /^Moved open to the group Location\.$/
                )
            ).toBeAttached();
            await expect(
                contentModelPage.groupTrigger('Location')
            ).toContainText('2 fields');
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['name', 'open', 'city']);
        });
    });

    test.describe('groups on their own blocks', () => {
        test('drags a group into a new order', async ({ contentModelPage }) => {
            await contentModelPage.goto('place');
            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Location', 'Extra']);

            await contentModelPage.dragGroup('Extra', 'Location');

            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Extra', 'Location']);
            await expect(contentModelPage.changeCount()).toBeVisible();
        });

        test('moves a group by keyboard', async ({
            page,
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.groupReorderHandle('Location').focus();
            await page.keyboard.press('Space');
            await expect(
                contentModelPage.announcement(
                    /^Picked up the group Location\.$/
                )
            ).toBeAttached();
            await page.keyboard.press('ArrowDown');
            await expect(
                contentModelPage.announcement(
                    /^The group Location is over the group Extra\.$/
                )
            ).toBeAttached();
            await page.keyboard.press('Space');
            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Extra', 'Location']);
        });

        test('drags a group taller than the first one to the top', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('trip');
            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Dates', 'Itinerary']);

            await contentModelPage.dragGroup('Itinerary', 'Dates');

            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Itinerary', 'Dates']);
        });

        test('moves a group taller than the first one to the top by keyboard', async ({
            page,
            contentModelPage
        }) => {
            await contentModelPage.goto('trip');
            await contentModelPage.groupReorderHandle('Itinerary').focus();
            await page.keyboard.press('Space');
            await expect(
                contentModelPage.announcement(
                    /^Picked up the group Itinerary\.$/
                )
            ).toBeAttached();
            await page.keyboard.press('ArrowUp');
            await expect(
                contentModelPage.announcement(
                    /^The group Itinerary is over the group Dates\.$/
                )
            ).toBeAttached();
            await page.keyboard.press('Space');
            await expect
                .poll(() => contentModelPage.groupNames())
                .toEqual(['Itinerary', 'Dates']);
        });

        test('edits a group from its menu', async ({ contentModelPage }) => {
            await contentModelPage.goto('place');
            await contentModelPage.groupMenu('Location').click();
            await contentModelPage.menuItem('Edit group').click();
            const sheet = contentModelPage.groupSheet('Location');
            await sheet.getByLabel('Starts folded').click();
            await sheet.getByLabel('Title').fill('Address');
            // The sheet is named by the group, so it follows the new title.
            await contentModelPage
                .groupSheet('Address')
                .getByRole('button', { name: 'Done' })
                .click();

            await expect(
                contentModelPage.groupTrigger('Address')
            ).toContainText('starts folded');
            await expect(contentModelPage.changeCount()).toBeVisible();
        });

        test('removes a group from its menu, keeping its fields', async ({
            contentModelPage
        }) => {
            await contentModelPage.goto('place');
            await contentModelPage.groupMenu('Location').click();
            await contentModelPage.menuItem('Remove group').click();

            await expect(contentModelPage.groupBlock('Location')).toHaveCount(
                0
            );
            await expect
                .poll(() => contentModelPage.fieldNames())
                .toEqual(['name', 'city', 'open']);
        });
    });

    test('adds a type from the rail and opens it', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto();
        await contentModelPage.newTypeButton().click();
        const dialog = contentModelPage.newTypeDialog();
        await dialog.getByLabel('Name', { exact: true }).fill('Events');
        await expect(dialog.getByLabel('Machine name')).toHaveValue('events');
        // The kind is two cards, each with an example of what it is.
        const asPage = dialog.getByRole('radio', { name: 'Page' });
        await expect(asPage).toHaveAccessibleDescription(/One entry/);
        await asPage.click();
        await expect(asPage).toHaveAttribute('aria-checked', 'true');
        await dialog.getByRole('button', { name: 'Create type' }).click();
        await expect(page).toHaveURL(/\/content-model\/events$/);
        await expect(contentModelPage.typeHeading('Events')).toBeVisible();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
        // A blank type starts empty, and says how to begin.
        await expect(page.getByText('No fields yet')).toBeVisible();
        await expect(contentModelPage.addFirstFieldButton()).toBeVisible();
        await expect(contentModelPage.reviewButton()).toBeDisabled();
    });

    test('starts a type from a template, with the features it picked', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto();
        await contentModelPage.newTypeButton().click();
        const dialog = contentModelPage.newTypeDialog();
        await dialog.getByLabel('Name', { exact: true }).fill('News');
        await dialog.getByRole('radio', { name: /^Article/ }).click();
        await dialog.getByRole('checkbox', { name: 'Localized' }).click();
        await dialog.getByRole('button', { name: 'Create type' }).click();

        await expect(contentModelPage.typeHeading('News')).toBeVisible();
        await expect
            .poll(() => contentModelPage.fieldNames())
            .toEqual(['title', 'slug', 'body', 'cover']);
        // Settings shows what was picked; a new type's flags stay changeable.
        await contentModelPage.settingsButton().click();
        const settings = contentModelPage.settingsSheet();
        await expect(
            settings.getByRole('switch', { name: 'Localized' })
        ).toBeChecked();
        await expect(
            settings.getByRole('switch', { name: 'Localized' })
        ).toBeEnabled();
    });

    test('finds a type in the rail by its name', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto();
        await contentModelPage.railSearch().fill('ven');
        await expect(contentModelPage.railLink('Venues')).toBeVisible();
        await expect(contentModelPage.railLink('Articles')).toHaveCount(0);
    });

    test('discards the draft back to the served model', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('venue');
        await contentModelPage.fieldMenu('open').click();
        await contentModelPage.menuItem('Remove').click();
        await expect(contentModelPage.changeCount()).toHaveText(
            '1 unsaved change'
        );
        await contentModelPage.discardButton().click();
        await expect
            .poll(() => contentModelPage.fieldNames())
            .toEqual(['name', 'city', 'open']);
        await expect(contentModelPage.changeCount()).toHaveCount(0);
    });

    test('asks before leaving the page with a draft — but not when moving between types', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('venue');
        await contentModelPage.fieldMenu('open').click();
        await contentModelPage.menuItem('Remove').click();

        await contentModelPage.railLink('Articles').click();
        await expect(contentModelPage.typeHeading('Articles')).toBeVisible();
        await expect(contentModelPage.unsavedChangesDialog()).toHaveCount(0);

        await contentModelPage.primaryNavLink('Webhooks').click();
        await expect(contentModelPage.unsavedChangesDialog()).toBeVisible();
    });

    test.describe('accessibility (axe)', () => {
        test('the editor', async ({ contentModelPage, makeAxe }) => {
            await contentModelPage.goto('article');
            await contentModelPage.addFieldButton().waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('adding a field: the kind picker, then the new field’s panel', async ({
            contentModelPage,
            makeAxe
        }) => {
            await contentModelPage.goto('article');
            await contentModelPage.addFieldButton().click();
            await contentModelPage.addFieldDialog().waitFor();
            await expectNoA11yViolations(makeAxe());

            await contentModelPage.fieldKind('Relation').click();
            await contentModelPage.reviewAction('Continue').click();
            await contentModelPage
                .newFieldSheet()
                .getByLabel('Label')
                .fill('Editor');
            await contentModelPage.fieldSheet('Editor').waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('the new type dialog and the type’s settings', async ({
            page,
            contentModelPage,
            makeAxe
        }) => {
            await contentModelPage.goto('article');
            await contentModelPage.newTypeButton().click();
            await contentModelPage.newTypeDialog().waitFor();
            await expectNoA11yViolations(makeAxe());
            await page.keyboard.press('Escape');

            await contentModelPage.settingsButton().click();
            await contentModelPage.settingsSheet().waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('a field sheet, each tab', async ({
            contentModelPage,
            makeAxe
        }) => {
            await contentModelPage.goto('article');
            await contentModelPage.editField('title').click();
            const sheet = contentModelPage.fieldSheet('title');
            for (const tab of ['General', 'Validation', 'Display']) {
                await sheet.getByRole('tab', { name: tab }).click();
                await expectNoA11yViolations(makeAxe());
            }
        });

        test('a relation’s sheet', async ({ contentModelPage, makeAxe }) => {
            await contentModelPage.goto('article');
            await contentModelPage.editField('author').click();
            await contentModelPage
                .fieldSheet('author')
                .getByText('How many')
                .waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('the groups sheet', async ({ contentModelPage, makeAxe }) => {
            await contentModelPage.goto('article');
            await contentModelPage.groupsButton().click();
            await contentModelPage.groupsSheet().waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
