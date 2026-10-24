import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces, WORKSPACES_SEED } from '../support/api/workspaces';
import {
    ADD_EVENTS_PLAN,
    mockSchemaApply,
    mockSchemaDocument,
    SCHEMA_TYPES_SEED,
    type SchemaApplyOptions
} from '../support/api/schemaBuilder';
import { expectNoA11yViolations } from '../support/a11y';

const OWNED = SCHEMA_TYPES_SEED.map((type) => ({
    ...type,
    origin: 'builder' as const
}));

/** `events` as the restarted server serves it — the type the suites add. */
const EVENTS = {
    name: 'events',
    kind: 'collection' as const,
    label: 'Events',
    publishable: true,
    paranoid: true,
    i18n: false,
    groups: [],
    fields: [],
    origin: 'builder' as const
};

/** Signs in, serves an editable model, and stubs the write routes. */
async function serve(page: Page, options: SchemaApplyOptions = {}) {
    await mockSignedIn(page);
    await mockWorkspaces(page);
    const calls = await mockSchemaApply(page, options);
    await mockSchemaDocument(page, {
        types: () => (calls.restarted ? [...OWNED, EVENTS] : OWNED),
        capabilities: { editable: true, restart: 'watch' },
        bootId: () => (calls.restarted ? 'boot-e2e-2' : 'boot-e2e')
    });
    return calls;
}

const DROP_AUTHOR = {
    id: 'type.remove:author',
    change: { kind: 'type.remove', type: 'author' },
    safety: 'destructive' as const,
    reason: 'drops-data',
    storage: true
};

/**
 * Review, apply and grant (`@orthacms/schema-builder-admin`, ADR-0020). The
 * review is one page: the changes grouped by type with their risk (a change
 * that deletes data confirmed on its own), the files and SQL folded under
 * "Technical details", and a bar at the foot with the migration name and
 * Apply. The apply is followed step by step to the restart; a new type is
 * offered to workspaces on the applied page, never granted implicitly.
 */
test.describe('Content model — review and apply', () => {
    test('reviews on one page: a skeleton, then the changes by type, the files and SQL on demand, and Apply at the foot', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page, { planDelayMs: 600 });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();

        await expect(page).toHaveURL(/\/content-model\/events\?review/);
        await expect(page.getByText('Checking your changes…')).toBeAttached();
        await expect(contentModelPage.applyChangesButton()).toHaveCount(0);
        const events = contentModelPage.changeGroup('Events');
        await expect(events.getByText('New collection')).toBeVisible();
        await expect(events.getByText('Safe')).toBeVisible();
        await expect(contentModelPage.reviewHeading()).toHaveText(
            'Review 1 change'
        );
        expect(calls.plans).toHaveLength(1);

        await contentModelPage.technicalDetails().click();
        await expect(
            page.getByText('src/content/collections/events.ts')
        ).toBeVisible();
        await page.getByRole('tab', { name: 'SQL' }).click();
        await expect(page.getByText(/CREATE TABLE "events"/)).toBeVisible();

        await expect(page.getByLabel('Migration name')).toHaveValue(
            /^[a-z][a-z0-9_]*$/
        );
        await expect(contentModelPage.applyChangesButton()).toHaveText(
            'Apply 1 change'
        );
        await expect(contentModelPage.applyChangesButton()).toBeEnabled();
        expect(calls.applies).toHaveLength(0);
    });

    test('a change that deletes data is confirmed on its own before Apply', async ({
        page,
        contentModelPage
    }) => {
        await serve(page, {
            plan: {
                ...ADD_EVENTS_PLAN,
                changes: [...ADD_EVENTS_PLAN.changes, DROP_AUTHOR]
            }
        });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        const confirm = page.getByRole('checkbox', {
            name: 'I understand this deletes data'
        });

        await expect(confirm).toBeVisible();
        await expect(
            contentModelPage
                .changeGroup('Authors')
                .getByText('Deletes data', { exact: true })
        ).toBeVisible();
        await expect(contentModelPage.applyChangesButton()).toBeDisabled();
        await expect(
            page.getByText('Confirm the change that deletes data.')
        ).toBeVisible();
        await confirm.click();
        await expect(contentModelPage.applyChangesButton()).toBeEnabled();
    });

    test('a stale document asks for a reload', async ({
        page,
        contentModelPage
    }) => {
        await serve(page, { planStatus: 409 });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();

        await expect(
            page.getByText(/The content model changed since this page loaded/)
        ).toBeVisible();
        await expect(contentModelPage.reviewAction('Reload')).toBeVisible();
    });

    test('going back — by the link or the browser — finds the draft untouched', async ({
        page,
        contentModelPage
    }) => {
        await serve(page);
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        await expect(contentModelPage.reviewHeading()).toBeVisible();

        await contentModelPage.backToModel().click();
        await expect(contentModelPage.changeCount()).toHaveText(
            '1 unsaved change'
        );
        await expect(contentModelPage.unsavedChangesDialog()).toBeHidden();

        await contentModelPage.reviewButton().click();
        await page.goBack();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
        await expect(contentModelPage.changeCount()).toHaveText(
            '1 unsaved change'
        );
    });

    test('applies step by step, waits for the restart, offers the new type to workspaces on the page, then returns', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page);
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        await contentModelPage.applyChangesButton().click();

        await expect(
            contentModelPage.outcomeHeading('Applying 1 change')
        ).toBeVisible();
        await expect(contentModelPage.applySteps()).toHaveCount(5);
        const grant = contentModelPage.grantCard();
        await expect(grant).toBeVisible({ timeout: 15_000 });
        await expect(contentModelPage.outcomeHeading('Applied')).toBeVisible();
        await expect(
            page.getByText(/migration 0007_add_events\.sql/)
        ).toBeVisible();
        expect(calls.applies).toEqual([
            expect.objectContaining({
                baseFingerprint: '0123456789abcdef',
                confirmed: []
            })
        ]);

        await expect(grant).toHaveAccessibleName('Use Events in workspaces');
        await expect(
            grant.getByRole('button', { name: 'Grant' })
        ).toBeDisabled();
        await grant.getByLabel(WORKSPACES_SEED[0].name).click();
        await grant
            .getByRole('button', { name: 'Grant to 1 workspace' })
            .click();
        await expect(grant).toBeHidden();
        await expect(
            page.getByText('Events can be used in 1 workspace now.')
        ).toBeVisible();
        expect(calls.grants).toEqual([
            { workspaceId: WORKSPACES_SEED[0].id, slug: 'events' }
        ]);

        await contentModelPage.backToModel().click();
        // The restarted server's model is the page's now: nothing to review.
        await expect(contentModelPage.reviewButton()).toBeHidden();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
    });

    test('a failed apply stops at its step, says so, and goes back to the review with the draft kept', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page, {
            outcome: 'failed',
            error: {
                code: 'schema-builder.migrate-failed',
                message: 'relation "events" already exists.'
            }
        });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        await contentModelPage.applyChangesButton().click();

        await expect(
            contentModelPage.outcomeHeading('The change was not applied')
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole('alert')).toContainText(
            'relation "events" already exists.'
        );
        expect(calls.restarted).toBe(false);

        await contentModelPage.reviewAction('Back to the review').click();
        await expect(contentModelPage.applyChangesButton()).toBeEnabled();
        await contentModelPage.backToModel().click();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
        await expect(contentModelPage.reviewButton()).toBeVisible();
    });

    test('has no axe violations on the review, the progress and the applied page', async ({
        page,
        contentModelPage,
        makeAxe
    }) => {
        await serve(page, {
            plan: {
                ...ADD_EVENTS_PLAN,
                changes: [...ADD_EVENTS_PLAN.changes, DROP_AUTHOR]
            }
        });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        const confirm = page.getByRole('checkbox', {
            name: 'I understand this deletes data'
        });
        await expect(confirm).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await confirm.click();
        await contentModelPage.technicalDetails().click();
        await expect(
            page.getByText('src/content/collections/events.ts')
        ).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await contentModelPage.applyChangesButton().click();
        await expect(
            contentModelPage.outcomeHeading('Applying 2 changes')
        ).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await expect(contentModelPage.grantCard()).toBeVisible({
            timeout: 15_000
        });
        await expectNoA11yViolations(makeAxe());
    });
});
