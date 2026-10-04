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
 * review is a page with steps, like the other wizards: the changes (a change
 * that deletes data confirmed on its own), the files and the SQL, then the
 * migration name and Apply. The apply is followed to the restart; a new type
 * is offered to workspaces, never granted implicitly.
 */
test.describe('Content model — review and apply', () => {
    test('reviews in steps: a skeleton, then the changes, the files and the SQL, then the name', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page, { planDelayMs: 600 });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();

        await expect(contentModelPage.reviewHeading()).toBeVisible();
        await expect(page).toHaveURL(/\/content-model\/events\?review/);
        await expect(page.getByText('Checking your changes…')).toBeAttached();
        await expect(
            contentModelPage.reviewAction('Continue to files')
        ).toBeDisabled();
        await expect(
            page.getByRole('list', { name: 'Changes' }).getByText('Safe')
        ).toBeVisible();
        expect(calls.plans).toHaveLength(1);

        await contentModelPage.reviewAction('Continue to files').click();
        await expect(
            contentModelPage.stepHeading('Files and SQL')
        ).toBeFocused();
        await expect(
            page.getByText('src/content/collections/events.ts')
        ).toBeVisible();
        await page.getByRole('tab', { name: 'SQL' }).click();
        await expect(page.getByText(/CREATE TABLE "events"/)).toBeVisible();

        await contentModelPage.reviewAction('Continue to apply').click();
        await expect(page.getByLabel('Migration name')).toHaveValue(
            /^[a-z][a-z0-9_]*$/
        );
        await expect(contentModelPage.reviewAction('Apply')).toBeEnabled();
        expect(calls.applies).toHaveLength(0);
    });

    test('a change that deletes data is confirmed on its own before going on', async ({
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
            contentModelPage.reviewAction('Continue to files')
        ).toBeDisabled();
        await expect(
            page.getByText('Confirm the change that deletes data.')
        ).toBeVisible();
        await confirm.click();
        await expect(
            contentModelPage.reviewAction('Continue to files')
        ).toBeEnabled();
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

    test('applies, waits for the restart, offers the new type to workspaces, then returns', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page);
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        await contentModelPage.continueToApply();
        await contentModelPage.reviewAction('Apply').click();

        await expect(
            contentModelPage.stepHeading('Applying the content model')
        ).toBeVisible();
        const grant = contentModelPage.grantDialog();
        await expect(grant).toBeVisible({ timeout: 15_000 });
        expect(calls.applies).toEqual([
            expect.objectContaining({
                baseFingerprint: '0123456789abcdef',
                confirmed: []
            })
        ]);

        await expect(
            grant.getByRole('button', { name: 'Grant' })
        ).toBeDisabled();
        await grant.getByLabel(WORKSPACES_SEED[0].name).click();
        await grant.getByRole('button', { name: 'Grant' }).click();
        await expect(grant).toBeHidden();
        expect(calls.grants).toEqual([
            { workspaceId: WORKSPACES_SEED[0].id, slug: 'events' }
        ]);

        await expect(contentModelPage.stepHeading('Applied')).toBeVisible();
        await expect(page.getByText('The content model is live')).toBeVisible();
        await contentModelPage.backToModel().click();
        // The restarted server's model is the page's now: nothing to review.
        await expect(contentModelPage.reviewButton()).toBeHidden();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
    });

    test('a failed apply says so, and goes back to the review with the draft kept', async ({
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
        await contentModelPage.continueToApply();
        await contentModelPage.reviewAction('Apply').click();

        const alert = page.getByRole('alert').filter({
            hasText: 'The change was not applied'
        });
        await expect(alert).toBeVisible({ timeout: 15_000 });
        await expect(alert).toContainText('relation "events" already exists.');
        expect(calls.restarted).toBe(false);

        await contentModelPage.reviewAction('Back to the review').click();
        await expect(contentModelPage.reviewAction('Apply')).toBeEnabled();
        await contentModelPage.backToModel().click();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
        await expect(contentModelPage.reviewButton()).toBeVisible();
    });

    test('has no axe violations on each step, the progress and the grant offer', async ({
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
        await contentModelPage.reviewAction('Continue to files').click();
        await expect(
            contentModelPage.stepHeading('Files and SQL')
        ).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await contentModelPage.reviewAction('Continue to apply').click();
        await expect(contentModelPage.stepHeading('Apply')).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await contentModelPage.reviewAction('Apply').click();
        await expect(
            contentModelPage.stepHeading('Applying the content model')
        ).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await expect(contentModelPage.grantDialog()).toBeVisible({
            timeout: 15_000
        });
        await expectNoA11yViolations(makeAxe());
    });
});
