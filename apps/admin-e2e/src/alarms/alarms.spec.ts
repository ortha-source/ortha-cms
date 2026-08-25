import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    CONTAINS_RULE,
    OPEN_FINDING,
    mockAlarmsApi
} from '../support/api/alarms';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

test.beforeEach(async ({ page }) => {
    await mockSignedIn(page);
    await mockWorkspaces(page);
});

/**
 * The alarms page and the rule editor, in a browser.
 *
 * This surface had **no** browser coverage, and could not have had any: the
 * signed-in admin every suite shares was seeded without `alarms:read`, so the
 * page, the rule editor, the entry rail's checks block and the records
 * "Save as rule" action all rendered for nobody. That absence is the reason a
 * cramped page and a `window.prompt` reached a user.
 */
test.describe('The alarms page', () => {
    test('carries the same page-context bar as every other section', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);

        await expect(alarmsPage.heading()).toBeVisible();
        // The bar is how a reader knows where they are, and the alarms page was
        // the one workspace section rendering its body with no chrome above it.
        await expect(alarmsPage.breadcrumbCurrent('Alarms')).toBeVisible();
    });

    test('lists what is flagged', async ({ page, alarmsPage }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);

        await expect(alarmsPage.finding(OPEN_FINDING.title)).toBeVisible();
        await expect(alarmsPage.tab('Flagged')).toBeVisible();
    });

    test('has no axe violations with a finding on screen', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);
        await expect(alarmsPage.finding(OPEN_FINDING.title)).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * Muting, which used to go through `window.prompt`.
 *
 * A native prompt is not merely ugly here: it blocks the whole tab, so the
 * record the finding is about cannot be consulted while answering, and a
 * browser that suppresses it returns `null` — indistinguishable from Cancel, so
 * the mute silently did not happen. Playwright dismisses dialogs by default,
 * which means the old flow would have failed this test by doing nothing at all.
 */
test.describe('Muting a finding', () => {
    test('asks for the reason in a dialog, and sends it', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);

        await alarmsPage.muteButton(OPEN_FINDING.title).click();
        await expect(alarmsPage.muteDialog()).toBeVisible();

        await alarmsPage.muteReason().fill('Deliberately a stub for now');
        await alarmsPage.muteConfirm().click();

        await expect
            .poll(() => api.mutes.length, { timeout: 5000 })
            .toBeGreaterThan(0);
        expect(api.mutes[0]).toMatchObject({
            reason: 'Deliberately a stub for now'
        });
    });

    test('has no axe violations with the dialog open', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.muteButton(OPEN_FINDING.title).click();
        await expect(alarmsPage.muteDialog()).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * The rule editor's condition block.
 *
 * Three things are asserted here that nothing else can see: that a stored
 * condition is legible **without** opening the builder, that the match count
 * appears on its own, and that the editor waits for the filterable-field
 * surface instead of rendering a builder whose Apply gate silently rejects
 * every rule.
 */
test.describe('The rule editor', () => {
    test('offers the way back in the breadcrumb, not only in the form', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);

        const back = alarmsPage.breadcrumbLink('Alarms');
        await expect(back).toBeVisible();
        await expect(back).toHaveAttribute(
            'href',
            `/workspaces/${WORKSPACE_ID}/alarms`
        );
        // The trail names the rule, so two open tabs are told apart by which
        // rule they are editing rather than both reading "Edit rule".
        await expect(
            alarmsPage.breadcrumbCurrent(CONTAINS_RULE.name)
        ).toBeVisible();
    });

    test('shows the stored condition as chips, without opening the builder', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);

        await expect(alarmsPage.conditionHeading()).toBeVisible();
        // The condition was invisible at rest: the page showed a label, a
        // button, and nothing that said what the rule actually looked for.
        await expect(alarmsPage.conditionChip(/Text/)).toBeVisible();
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();
        // The builder itself stays collapsed until asked for.
        await expect(alarmsPage.conditionToggle()).toHaveAccessibleName(
            'Edit conditions'
        );
    });

    test('counts the matching records without being asked', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { previewMatched: 3, previewTotal: 312 });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);

        // "3 of 312" is the one number that says whether a rule means what its
        // author thinks, and it used to appear only if you knew to press a
        // button labelled "Count matches".
        await expect(alarmsPage.matchCount()).toContainText('3 record');
        await expect(alarmsPage.matchCount()).toContainText('312');
    });

    test('warns when a condition matches the entire collection', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { previewMatched: 312, previewTotal: 312 });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);

        // A rule that flags everything is almost always inverted, and the
        // denominator is what makes that visible at a glance.
        await expect(alarmsPage.matchCount()).toContainText(
            'every record in the collection'
        );
    });

    test('says nothing is saved until the conditions are saved', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();

        // At rest the stored condition matches what is on screen, so there is
        // nothing to warn about — the notice must not cry wolf on arrival.
        await expect(alarmsPage.unsavedNotice()).toBeHidden();

        // Removing a chip commits a narrowed tree immediately, the same as in
        // the records toolbar — which is exactly the moment the page and the
        // stored rule diverge.
        await alarmsPage
            .conditionChips()
            .first()
            .locator('[data-qb-chip-remove]')
            .click();
        await expect(alarmsPage.unsavedNotice()).toBeVisible();
    });

    test('cannot be saved with no conditions at all', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();

        await alarmsPage.clearAllConditions();

        // An empty condition means "flag every record". Saving used to leave
        // the previous filter in place instead — a silent no-op on a page whose
        // whole job is to change that filter.
        await expect(alarmsPage.saveButton()).toBeDisabled();
    });

    /**
     * The load state of the filterable-field surface.
     *
     * `useFilterFields` documents this exactly: "an empty surface, a
     * still-loading surface, and a failed request are three different things,
     * and the query builder's Apply gate rejects every rule whose field it
     * cannot resolve. Collapsing them makes Apply a silent no-op with nothing
     * on screen explaining why." The editor was passing `fields` alone.
     */
    test('waits for the filterable fields instead of drawing a dead builder', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { filterFieldsDelayMs: 2000 });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await alarmsPage.conditionToggle().click();

        await expect(alarmsPage.fieldsLoading()).toBeVisible();
        // Disabled rather than dead: pressing it before the surface lands could
        // never commit anything, so it says so.
        await expect(alarmsPage.applyButton()).toBeDisabled();

        await expect(alarmsPage.fieldsLoading()).toBeHidden({ timeout: 10000 });
        await expect(alarmsPage.applyButton()).toBeEnabled();
    });

    test('explains a failed field surface rather than going quiet', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { filterFieldsFailing: true });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await alarmsPage.conditionToggle().click();

        // The query client retries 3x with exponential backoff, so the error
        // state lands ~7s in — past the default expect timeout.
        await expect(alarmsPage.filterFieldsError()).toContainText(
            "Couldn't load the filterable fields",
            { timeout: 20_000 }
        );
        await expect(alarmsPage.applyButton()).toBeDisabled();
    });

    test('sends the conditions on screen when saved', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();

        await alarmsPage.saveButton().click();

        await expect
            .poll(() => api.updates.length, { timeout: 5000 })
            .toBeGreaterThan(0);
        // The filter is always sent, never omitted to mean "leave it alone":
        // the editor is the only place a rule's condition is changed, so an
        // update that quietly kept the old one would be the worst outcome
        // available to it.
        expect(api.updates[0].filter).toEqual(CONTAINS_RULE.filter);
    });

    test('has no axe violations with the builder open', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await alarmsPage.conditionToggle().click();
        await expect(alarmsPage.applyButton()).toBeEnabled();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * Conditions over **slot-contributed** filter fields.
 *
 * The records list offers two sets of filterable paths: the server-derived ones
 * from `/content-schema/:name/filter-fields`, and whatever plugins add through
 * `RECORDS_FILTER_FIELDS_SLOT` — i18n's `localeCount` / `hasLocale` /
 * `missingLocale`, answered at evaluation time by that plugin's own subqueries.
 * An alarm saved from that list can carry either. The editor read only the
 * first, so a locale condition came back as "This field is no longer
 * available — pick another one" and the Apply gate then refused every edit to
 * the alarm, because it rejects any rule whose field it cannot resolve.
 */
test.describe('An alarm over a locale field', () => {
    /** The rule the bug report was about: a condition on `localeCount`. */
    const LOCALE_RULE = {
        ...CONTAINS_RULE,
        name: 'Half-translated',
        findingTitle: 'Fewer than two locales',
        filter: {
            and: [{ field: 'localeCount', op: 'lt', value: 2 }]
        }
    };

    test('renders as a readable condition, not as a missing field', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { rules: [LOCALE_RULE] });
        await alarmsPage.gotoRule(WORKSPACE_ID, LOCALE_RULE.id);

        // The slot's label, resolved — which is only possible if the editor
        // offers the same field surface the records list does.
        await expect(alarmsPage.conditionChip(/Locale count/)).toBeVisible();
    });

    test('can still be applied, so the alarm stays editable', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { rules: [LOCALE_RULE] });
        await alarmsPage.gotoRule(WORKSPACE_ID, LOCALE_RULE.id);
        await alarmsPage.conditionToggle().click();

        // The gate walks every rule in the draft, so one unresolvable field
        // blocks the whole commit — including conditions the user just added.
        await expect(alarmsPage.applyButton()).toBeEnabled();
        await alarmsPage.applyButton().click();
        await expect(alarmsPage.conditionChip(/Locale count/)).toBeVisible();
    });
});

/**
 * Creating an alarm from the alarms page.
 *
 * "Save as alarm" in the records toolbar is still the better path — there the
 * condition has already been checked against rows the author looked at — but it
 * is not the only one someone reaches for, and a page listing alarms with no
 * way to add one reads as broken.
 */
test.describe('Creating an alarm', () => {
    test('is offered from the alarms page', async ({ page, alarmsPage }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);

        await alarmsPage.newAlarmButton().click();
        await expect(alarmsPage.breadcrumbCurrent('New alarm')).toBeVisible();
    });

    test('asks what to watch before it offers any conditions', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoNewRule(WORKSPACE_ID);

        // A condition builder over no collection has no fields to offer, so it
        // says what is missing rather than opening onto an empty picker.
        await expect(alarmsPage.conditionToggle()).toBeDisabled();
        await expect(
            page.getByText('Choose a collection above to set conditions.')
        ).toBeVisible();
        await expect(alarmsPage.saveButton()).toBeDisabled();
    });

    test('creates the alarm and reports what it flagged', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page, { previewMatched: 4 });
        await alarmsPage.gotoNewRule(WORKSPACE_ID);

        await alarmsPage.chooseContentType('Articles');
        await alarmsPage.fillAlarmName('Missing numbers');
        await alarmsPage.fillFindingTitle('This has no number');

        await alarmsPage.conditionToggle().click();
        await alarmsPage.addRule();
        await alarmsPage.selectField('Number');
        await alarmsPage.selectOperatorExact('is empty');
        await alarmsPage.applyButton().click();

        await expect(alarmsPage.conditionChip(/Number/)).toBeVisible();
        await alarmsPage.saveButton().click();

        await expect
            .poll(() => api.creates.length, { timeout: 5000 })
            .toBeGreaterThan(0);
        expect(api.creates[0]).toMatchObject({
            contentType: 'test_article',
            name: 'Missing numbers',
            findingTitle: 'This has no number'
        });
    });

    test('has no axe violations on the empty create form', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoNewRule(WORKSPACE_ID);
        await expect(alarmsPage.conditionHeading()).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
