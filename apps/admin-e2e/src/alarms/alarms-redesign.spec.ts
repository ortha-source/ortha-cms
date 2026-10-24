import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { WORKSPACES_SEED, mockWorkspaces } from '../support/api/workspaces';
import {
    CONTAINS_RULE,
    CONTENT_TYPE_SUMMARY,
    OPEN_FINDING,
    mockAlarmsApi,
    type AlarmFindingSeed,
    type AlarmRuleSeed
} from '../support/api/alarms';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/** The default seed, with the alarms fixture's collection granted. */
const ALARMS_WORKSPACES = WORKSPACES_SEED.map((workspace) =>
    workspace.id === WORKSPACE_ID
        ? {
              ...workspace,
              content: [...(workspace.content ?? []), CONTENT_TYPE_SUMMARY.name]
          }
        : workspace
);

test.beforeEach(async ({ page }) => {
    await mockSignedIn(page);
    await mockWorkspaces(page, ALARMS_WORKSPACES);
});

/** A flagged record the server could name. */
const TITLED_FINDING: AlarmFindingSeed = {
    ...OPEN_FINDING,
    entryTitle: 'Spring launch — what changed'
};

/** An alarm switched off, never checked, flagging nothing. */
const OFF_RULE: AlarmRuleSeed = {
    ...CONTAINS_RULE,
    id: 'rule-off',
    name: 'Draft for a month',
    severity: 'info',
    enabled: false,
    lastScanAt: null,
    openCount: 0
};

/** An alarm whose condition names a field the type no longer has. */
const BROKEN_RULE: AlarmRuleSeed = {
    ...CONTAINS_RULE,
    id: 'rule-broken',
    name: 'Stale pricing',
    severity: 'warn',
    filter: { and: [{ field: 'category', op: 'eq', value: 'enterprise' }] },
    brokenReason: 'unknown field "category"',
    openCount: 0
};

/**
 * The R7 redesign of the alarms page — the Flagged view, each record by name,
 * worst alarm first.
 */
test.describe('Flagged', () => {
    test('names each record and leads to it, and to the full list in Records', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, { findings: [TITLED_FINDING] });
        await alarmsPage.goto(WORKSPACE_ID);

        // The record by title, not by id — an id is nothing anyone can act on.
        const row = alarmsPage.groupRow(
            CONTAINS_RULE.name,
            'Spring launch — what changed'
        );
        await expect(row).toBeVisible();
        await expect(row).toContainText('Articles');
        await expect(row).toContainText(/flagged .+ ago/);
        await expect(
            alarmsPage.groupOpen('Spring launch — what changed')
        ).toHaveAttribute(
            'href',
            `/workspaces/${WORKSPACE_ID}/content/test_article/${OPEN_FINDING.entryId}`
        );

        // The footer says how many of how many, and hands the whole set to the
        // records list with the alarm's own condition as the filter.
        await expect(page.getByText('1 of 1', { exact: true })).toBeVisible();
        const showAll = alarmsPage.groupShowAll(CONTAINS_RULE.name);
        const href = await showAll.getAttribute('href');
        expect(href).toContain(
            `/workspaces/${WORKSPACE_ID}/content/test_article?filter=`
        );
        expect(
            JSON.parse(decodeURIComponent(href?.split('filter=')[1] ?? ''))
        ).toEqual(CONTAINS_RULE.filter);
    });

    test('says what each alarm shows editors, on its header', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);

        await expect(
            page.getByText(
                `Articles · shows editors “${CONTAINS_RULE.findingTitle}”`
            )
        ).toBeVisible();
    });
});

/**
 * The Alarms tab: each alarm with its condition as chips, an on/off switch,
 * and a broken one saying what to fix.
 */
test.describe('The Alarms tab', () => {
    test('shows each condition as the records filter’s chips', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        const card = alarmsPage.ruleCard(CONTAINS_RULE.name);
        await expect(card).toContainText('Articles');
        await expect(
            alarmsPage.ruleChip(CONTAINS_RULE.name, /Status/)
        ).toContainText('published');
        await expect(
            alarmsPage.ruleChip(CONTAINS_RULE.name, /Text/)
        ).toContainText('QWERT');
        // A read-out: nothing on the list removes a condition.
        await expect(card.locator('[data-condition-chip-remove]')).toHaveCount(
            0
        );
        await expect(card).toContainText('1 flagged');
        await expect(card).toContainText(/checked /);
    });

    test('pauses an alarm with its switch instead of deleting it', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        const toggle = alarmsPage.ruleSwitch(CONTAINS_RULE.name);
        await expect(toggle).toBeChecked();
        await toggle.click();

        await expect
            .poll(() => api.updates, { timeout: 5000 })
            .toEqual([{ enabled: false }]);
        await expect(
            page.getByText(`${CONTAINS_RULE.name} is off.`, { exact: false })
        ).toBeVisible();
    });

    test('reports the re-check when an alarm is switched back on', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page, {
            rules: [OFF_RULE],
            findings: [],
            previewMatched: 12,
            previewTotal: 90
        });
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        const card = alarmsPage.ruleCard(OFF_RULE.name);
        await expect(card).toContainText('Nothing flagged');
        await expect(card).toContainText('checked never');
        await expect(alarmsPage.ruleSwitch(OFF_RULE.name)).not.toBeChecked();

        await alarmsPage.ruleSwitch(OFF_RULE.name).click();
        await expect
            .poll(() => api.updates, { timeout: 5000 })
            .toEqual([{ enabled: true }]);
        // Switching on rescans server-side, and the toast says what it found.
        await expect(
            page.getByText(
                `${OFF_RULE.name}: checked 90, 12 flagged, 2 cleared.`
            )
        ).toBeVisible();
    });

    test('says which field a broken alarm lost [alarms:I-08]', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, {
            rules: [CONTAINS_RULE, BROKEN_RULE]
        });
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        await expect(alarmsPage.ruleCard(BROKEN_RULE.name)).toContainText(
            '“Category” no longer exists on Articles — fix the condition.'
        );
        // The lost field still reads as a condition, not as a blank chip.
        await expect(
            alarmsPage.ruleChip(BROKEN_RULE.name, /Category/)
        ).toBeVisible();
    });

    test('opens an alarm’s group from its “N flagged”', async ({
        page,
        alarmsPage
    }) => {
        const second: AlarmRuleSeed = {
            ...CONTAINS_RULE,
            id: 'rule-2',
            name: 'Second alarm',
            openCount: 9
        };
        await mockAlarmsApi(page, { rules: [CONTAINS_RULE, second] });
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        await alarmsPage.ruleFlagged(CONTAINS_RULE.name).click();

        await expect(alarmsPage.tab('Flagged')).toHaveAttribute(
            'aria-selected',
            'true'
        );
        await expect(alarmsPage.group(CONTAINS_RULE.name)).toHaveAttribute(
            'aria-expanded',
            'true'
        );
    });

    test('offers Edit, Re-check and Delete from its menu, by keyboard', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page);
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();

        const trigger = alarmsPage.ruleMenu(CONTAINS_RULE.name);
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(alarmsPage.menuItem('Edit')).toBeVisible();
        await expect(alarmsPage.menuItem('Delete')).toBeVisible();
        await alarmsPage.menuItem('Re-check').click();
        await expect
            .poll(() => api.rescans, { timeout: 5000 })
            .toEqual([CONTAINS_RULE.id]);

        await trigger.click();
        await alarmsPage.menuItem('Delete').click();
        await expect(
            page.getByRole('alertdialog', { name: 'Delete this alarm?' })
        ).toBeVisible();
    });

    test('has no axe violations with a broken and a paused alarm', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page, {
            rules: [CONTAINS_RULE, BROKEN_RULE, OFF_RULE]
        });
        await alarmsPage.goto(WORKSPACE_ID);
        await alarmsPage.tab('Alarms').click();
        await expect(
            alarmsPage.ruleChip(BROKEN_RULE.name, /Category/)
        ).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});

/**
 * The editor's "Right now" panel: the live count, a sample of the records by
 * title, and the finding as editors will see it.
 */
test.describe('New alarm', () => {
    test('previews the count, a sample by title and what editors will see', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page, {
            previewMatched: 38,
            previewTotal: 842
        });
        await alarmsPage.gotoNewRule(WORKSPACE_ID);

        await expect(alarmsPage.matchCount()).toHaveText(
            'Pick what to watch to see what this alarm would flag.'
        );

        await alarmsPage.chooseContentType('Articles');
        await alarmsPage.fillAlarmName('No SEO description');
        await alarmsPage.fillFindingTitle('Add a meta description');
        await alarmsPage.level('Error').click();

        await alarmsPage.openFilters();
        await alarmsPage.addRule();
        await alarmsPage.selectField('Number');
        await alarmsPage.selectOperatorExact('is empty');
        await alarmsPage.applyButton().click();

        await expect(alarmsPage.matchCount()).toHaveText(
            /^38\s*of 842 articles would be flagged$/
        );
        await expect(
            alarmsPage.previewSample().getByRole('listitem')
        ).toHaveText([
            'Spring launch — what changed',
            'Pricing FAQ',
            'The editor, redesigned',
            // Untitled: named by id rather than given an invented label.
            'entry-14'
        ]);
        await expect(
            page.getByText('and 34 more · updates as you edit')
        ).toBeVisible();
        await expect(alarmsPage.editorsWillSee()).toContainText(
            'Add a meta description'
        );
        await expect(alarmsPage.editorsWillSee()).toContainText(
            'No SEO description · Error'
        );

        await alarmsPage.saveButton().click();
        await expect
            .poll(() => api.creates.length, { timeout: 5000 })
            .toBeGreaterThan(0);
        expect(api.creates[0]).toMatchObject({
            contentType: 'test_article',
            name: 'No SEO description',
            findingTitle: 'Add a meta description',
            severity: 'error'
        });
        // Back on the list, the toast says what the first scan found.
        await expect(
            page.getByText('checked 842, 38 flagged, 0 cleared.', {
                exact: false
            })
        ).toBeVisible();
    });

    test('moves between levels with the arrow keys', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page);
        await alarmsPage.gotoNewRule(WORKSPACE_ID);

        await alarmsPage.level('Warning').focus();
        await page.keyboard.press('ArrowRight');
        await expect(alarmsPage.level('Info')).toBeFocused();
        await page.keyboard.press('Space');
        await expect(alarmsPage.level('Info')).toHaveAttribute(
            'aria-checked',
            'true'
        );
    });
});

/** Editing: the inverted-condition hint and what Save reports. */
test.describe('Edit alarm', () => {
    test('names the collection, the author and what is flagged now', async ({
        page,
        alarmsPage
    }) => {
        await mockAlarmsApi(page, {
            rules: [{ ...CONTAINS_RULE, openCount: 38 }]
        });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);

        await expect(
            page.getByText(
                'Articles · created by Ada Lovelace · 38 records flagged now'
            )
        ).toBeVisible();
        // The collection is shown, and fixed.
        await expect(
            page.getByRole('combobox', { name: 'What to watch' })
        ).toBeDisabled();
    });

    test('catches the inverted condition and marks the changed chip', async ({
        page,
        alarmsPage,
        makeAxe
    }) => {
        await mockAlarmsApi(page, { previewMatched: 312, previewTotal: 312 });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();

        // Rewrite the first stored condition (Status is published) into a new
        // one: when everything matches, the changed one is the likely culprit.
        await alarmsPage.openFilters();
        await alarmsPage.selectField('Number');
        await alarmsPage.selectOperatorExact('is empty');
        await alarmsPage.applyButton().click();

        await expect(alarmsPage.invertedHint()).toBeVisible();
        await expect(alarmsPage.conditionChip(/Number/)).toHaveAttribute(
            'data-suspect',
            'true'
        );
        await expect(alarmsPage.conditionChip(/QWERT/)).not.toHaveAttribute(
            'data-suspect',
            'true'
        );
        await expect(alarmsPage.unsavedNotice()).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });

    test('reports checked, flagged and cleared after saving', async ({
        page,
        alarmsPage
    }) => {
        const api = await mockAlarmsApi(page, {
            previewMatched: 38,
            previewTotal: 842
        });
        await alarmsPage.gotoRule(WORKSPACE_ID, CONTAINS_RULE.id);
        await expect(alarmsPage.conditionChip(/QWERT/)).toBeVisible();

        // Save sits in the top bar while editing.
        await alarmsPage.saveButton().click();
        await expect.poll(() => api.updates.length, { timeout: 5000 }).toBe(1);
        await expect(
            page.getByText(
                `${CONTAINS_RULE.name}: checked 842, 38 flagged, 2 cleared.`
            )
        ).toBeVisible();
    });
});
