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
 * Review, apply and grant (`@orthacms/schema-builder-admin`, ADR-0020): the
 * review shows the server's plan; a change that deletes data is confirmed on
 * its own; the apply is followed to the restart; a new type is offered to
 * workspaces, never granted implicitly.
 */
test.describe('Content model — review and apply', () => {
    test('reviews the plan: a skeleton, then the changes, the files and the SQL', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page, { planDelayMs: 600 });
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();

        const drawer = contentModelPage.changesDrawer();
        await expect(drawer.getByRole('status')).toBeVisible();
        await expect(contentModelPage.applyChangesButton()).toBeDisabled();
        await expect(
            drawer.getByRole('list', { name: 'Changes' }).getByText('Safe')
        ).toBeVisible();
        await expect(drawer.getByLabel('Migration name')).toHaveValue(
            /^[a-z][a-z0-9_]*$/
        );
        await expect(contentModelPage.applyChangesButton()).toBeEnabled();
        expect(calls.plans).toHaveLength(1);

        await drawer.getByRole('tab', { name: 'Files' }).click();
        await expect(drawer.getByText('collections/events.ts')).toBeVisible();
        await drawer.getByRole('tab', { name: 'SQL' }).click();
        await expect(drawer.getByText(/CREATE TABLE "events"/)).toBeVisible();
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
        const drawer = contentModelPage.changesDrawer();
        const confirm = drawer.getByRole('checkbox', {
            name: 'I understand this deletes data'
        });

        await expect(confirm).toBeVisible();
        await expect(contentModelPage.applyChangesButton()).toBeDisabled();
        await expect(
            drawer.getByText('Confirm the change that deletes data.')
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
            contentModelPage
                .changesDrawer()
                .getByText(/The content model changed since this page loaded/)
        ).toBeVisible();
        await expect(
            contentModelPage
                .changesDrawer()
                .getByRole('button', { name: 'Reload' })
        ).toBeVisible();
    });

    test('applies, waits for the restart, then offers the new type to workspaces', async ({
        page,
        contentModelPage
    }) => {
        const calls = await serve(page);
        await contentModelPage.goto('article');
        await contentModelPage.addType('Events');
        await contentModelPage.reviewButton().click();
        await contentModelPage.applyChangesButton().click();

        await expect(contentModelPage.applyProgress()).toBeVisible();
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

        // The restarted server's model is the page's now: nothing left to review.
        await expect(
            contentModelPage
                .applyProgress()
                .getByText('The content model is live')
        ).toBeVisible();
        await expect(contentModelPage.reviewButton()).toBeHidden();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
    });

    test('a failed apply says so and keeps the draft', async ({
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

        const alert = page.getByRole('alert').filter({
            hasText: 'The change was not applied'
        });
        await expect(alert).toBeVisible({ timeout: 15_000 });
        await expect(alert).toContainText('relation "events" already exists.');
        expect(calls.restarted).toBe(false);
        await alert.getByRole('button', { name: 'Close' }).click();
        await expect(contentModelPage.reviewButton()).toBeVisible();
        await expect(contentModelPage.railLink('Events')).toBeVisible();
    });

    test('has no axe violations in the review, the progress and the grant offer', async ({
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
        await expect(
            contentModelPage.changesDrawer().getByRole('checkbox')
        ).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await contentModelPage
            .changesDrawer()
            .getByRole('checkbox', { name: 'I understand this deletes data' })
            .click();
        await contentModelPage.applyChangesButton().click();
        await expect(contentModelPage.applyProgress()).toBeVisible();
        await expectNoA11yViolations(makeAxe());

        await expect(contentModelPage.grantDialog()).toBeVisible({
            timeout: 15_000
        });
        await expectNoA11yViolations(makeAxe());
    });
});
