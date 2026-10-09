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
 * one rank, and one with a group holding a field and a group holding none.
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

    test('adds a field in steps: the kind by keyboard, the name from the label, then the rules', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await expect(contentModelPage.addFieldHeading()).toBeVisible();
        await expect(page).toHaveURL(/\/content-model\/article\?addField/);

        await contentModelPage.fieldKind('Short text').focus();
        await page.keyboard.press('ArrowRight');
        await expect(contentModelPage.fieldKind('Long text')).toHaveAttribute(
            'aria-checked',
            'true'
        );
        await expect(contentModelPage.fieldKind('Long text')).toBeFocused();
        await contentModelPage.reviewAction('Continue').click();

        await page.getByLabel('Label').fill('Summary text');
        await expect(page.getByLabel('Machine name')).toHaveValue(
            'summaryText'
        );
        await contentModelPage.reviewAction('Continue').click();
        await expect(
            page.getByRole('heading', { level: 3, name: 'Validation' })
        ).toBeVisible();
        await contentModelPage.reviewAction('Add field').click();

        await expect(contentModelPage.changeCount()).toHaveText(
            '1 unsaved change'
        );
        await expect(page).toHaveURL(/\/content-model\/article$/);
        await expect(contentModelPage.editField('summaryText')).toBeVisible();
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

    test('leaving the add-field page keeps nothing half-made', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto('article');
        await contentModelPage.addFieldButton().click();
        await contentModelPage.reviewAction('Continue').click();
        await page.getByLabel('Label').fill('Subtitle');
        await page.goBack();
        await expect(contentModelPage.addFieldButton()).toBeVisible();
        await expect(contentModelPage.changeCount()).toBeHidden();
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
        await sheet.getByRole('tab', { name: 'Validation' }).click();

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
        await sheet.getByRole('tab', { name: 'Validation' }).click();

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

    test('reorders within one rank by keyboard, and refuses a move across ranks', async ({
        contentModelPage
    }) => {
        await contentModelPage.goto('venue');
        await expect
            .poll(() => contentModelPage.fieldNames('General'))
            .toEqual(['name', 'city', 'open']);

        await contentModelPage.moveFieldUp('city');
        await expect
            .poll(() => contentModelPage.fieldNames('General'))
            .toEqual(['city', 'name', 'open']);

        // A boolean is a choice, ranked after inputs: the editor would put it back.
        await contentModelPage.moveFieldUp('open');
        await expect(
            contentModelPage.announcement(/open stays where it is/)
        ).toBeAttached();
        await expect
            .poll(() => contentModelPage.fieldNames('General'))
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
        await field.getByLabel('Group on the General tab').click();
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
                .poll(() => contentModelPage.fieldNames('General'))
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
                .poll(() => contentModelPage.fieldNames('General'))
                .toEqual(['open', 'name', 'city']);
            await expect(contentModelPage.changeCount()).toBeVisible();

            // The field's own Display tab says the same.
            await contentModelPage.editField('name').click();
            const sheet = contentModelPage.fieldSheet('name');
            await sheet.getByRole('tab', { name: 'Display' }).click();
            await expect(
                sheet.getByLabel('Group on the General tab')
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
                .poll(() => contentModelPage.fieldNames('General'))
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
                .poll(() => contentModelPage.fieldNames('General'))
                .toEqual(['city', 'name', 'open']);
            // The group it left is empty now, and says so.
            await expect(
                contentModelPage.emptyGroupDropZone('Location')
            ).toBeVisible();
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
                .poll(() => contentModelPage.fieldNames('General'))
                .toEqual(['name', 'open', 'city']);
        });
    });

    test('adds a type from the rail and opens it', async ({
        page,
        contentModelPage
    }) => {
        await contentModelPage.goto();
        await contentModelPage.newTypeButton().click();
        const dialog = page.getByRole('dialog', { name: 'New content type' });
        await dialog.getByLabel('Label').fill('Events');
        await dialog.getByLabel('Page').check();
        await dialog.getByRole('button', { name: 'Add type' }).click();
        await expect(page).toHaveURL(/\/content-model\/events$/);
        await expect(contentModelPage.typeHeading('Events')).toBeVisible();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
        // A new type starts empty, and says how to begin.
        await expect(page.getByText('No fields yet')).toBeVisible();
        await expect(contentModelPage.addFirstFieldButton()).toBeVisible();
        await expect(contentModelPage.reviewButton()).toBeDisabled();
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
            .poll(() => contentModelPage.fieldNames('General'))
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

        test('the add-field page, each step', async ({
            page,
            contentModelPage,
            makeAxe
        }) => {
            await contentModelPage.goto('article');
            await contentModelPage.addFieldButton().click();
            await contentModelPage.addFieldHeading().waitFor();
            await expectNoA11yViolations(makeAxe());

            await contentModelPage.fieldKind('Relation').click();
            await contentModelPage.reviewAction('Continue').click();
            await page.getByLabel('Label').fill('Editor');
            await expectNoA11yViolations(makeAxe());

            await contentModelPage.reviewAction('Continue').click();
            await contentModelPage.stepHeading('Rules and display').waitFor();
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
