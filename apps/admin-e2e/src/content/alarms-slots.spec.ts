import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    mockEntryRelations
} from '../support/api/content';
import {
    OPEN_FINDING,
    mockAlarmsSlots,
    type AlarmFindingSeed
} from '../support/api/alarms';

const WS = LIBRARY_WORKSPACE.id;
/** The collection this suite reads, and the label its table carries. */
const TYPE = 'blog_post';
const TABLE = 'Blog posts';
/** The first row of the fabricated page — the record whose editor is opened. */
const ENTRY = 'blog_post-01';

/** One open finding on {@link ENTRY}, as the by-entry batch returns it. */
const ENTRY_FINDING: AlarmFindingSeed = {
    ...OPEN_FINDING,
    contentType: TYPE,
    entryId: ENTRY,
    title: 'Author is not published',
    ruleName: 'Draft authors'
};

/**
 * Alarms **inside the Content Library** — the three slots the feature actually
 * reaches editors through.
 *
 * None of this is on the alarms page: an editor never opens it. They open an
 * article and the problem is sitting beside it (`ENTRY_SIDEBAR_WIDGET_SLOT`),
 * or they scan a list with the optional Checks column on
 * (`RECORDS_COLUMN_SLOT`), or they filter a list down to what looks wrong and
 * press "Save as alarm" (`RECORDS_TOOLBAR_SLOT`) — which is how rules are
 * really made. All three ran against `content-admin` with no browser test of
 * any kind: `apps/admin-e2e/src/content/` did not mention alarms.
 */
test.describe('Alarms in the Content Library', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
        // The editor loads relations on open; blog_post has none, so serve
        // empty rather than letting the request reach the dev proxy.
        await mockEntryRelations(page);
    });

    /**
     * The column is **off by default** and its `useRowsData` hook runs anyway —
     * it has to, because skipping the call would change React's hook order
     * between renders. So the only thing standing between a hidden column and a
     * batch request on every page of every list is `isVisible` reaching the
     * query's `enabled`, and nothing on screen shows whether it did.
     */
    test('the Checks column asks for nothing while it is hidden [alarms:I-31]', async ({
        page,
        contentLibraryPage
    }) => {
        const api = await mockAlarmsSlots(page, { byEntry: {} });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);

        expect(api.byEntryRequests).toEqual([]);

        // And a second page, because "off" has to mean off everywhere: a hook
        // that ignored `isVisible` would fire once per page of every list in
        // the workspace. Paging also settles the first page's render — the
        // rows for page 2 cannot be on screen until page 1's effects have run,
        // so a request queued there would already be in the recorder.
        // Activated from the keyboard, the way `records-resilience.spec.ts`
        // pages: the copilot dock is `fixed bottom-3 right-4` and floats over
        // the records footer, so a click lands on the dock rather than on the
        // control. Same activation, same assertions — only the pointer avoided.
        await contentLibraryPage.nextPage.focus();
        await page.keyboard.press('Enter');
        await expect(contentLibraryPage.pageReadout).toHaveText('Page 2 of 3');
        expect(api.byEntryRequests).toEqual([]);

        await contentLibraryPage.showChecksColumn();

        // One request for the page — not one per row — and only now.
        await expect
            .poll(() => api.byEntryRequests.length, { timeout: 5000 })
            .toBe(1);
        expect(api.byEntryRequests[0].split(',')).toHaveLength(10);
    });

    /**
     * Three answers that an empty cell would flatten into one, and only the
     * last of them means the record is fine.
     */
    test('the Checks cell tells checking, not-checked and nothing-flagged apart [alarms:I-33]', async ({
        page,
        contentLibraryPage
    }) => {
        // Three states, three page loads, and a `5xx` costs the retry ladder
        // (~7s) before the query gives up — comfortably past the 30s default.
        test.setTimeout(90_000);
        // 1. Still checking — the batch held open.
        await mockAlarmsSlots(page, { byEntry: {}, byEntryDelayMs: 3000 });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);
        await contentLibraryPage.showChecksColumn();

        const checking = await contentLibraryPage.checksCells(TABLE);
        await expect(checking.first()).toHaveText('Checking…');
        await expect(checking.first()).not.toHaveText('Nothing flagged');

        // 2. Could not check. The column selection is component state and
        //    resets with the reload, so it is switched back on each time.
        await mockAlarmsSlots(page, { byEntryFailing: true });
        await page.reload();
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);
        await contentLibraryPage.showChecksColumn();

        const failed = await contentLibraryPage.checksCells(TABLE);
        await expect(failed.first()).toHaveText('Not checked', {
            timeout: 15_000
        });

        // 3. Checked, and clean. Distinct wording from both of the above,
        //    because "we could not ask" reading as "nothing is wrong" is the
        //    whole failure this column would otherwise introduce.
        await mockAlarmsSlots(page, { byEntry: {} });
        await page.reload();
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);
        await contentLibraryPage.showChecksColumn();

        const clean = await contentLibraryPage.checksCells(TABLE);
        await expect(clean.first()).toHaveText('Nothing flagged');
    });

    /**
     * A flagged row's cell: one glyph per severity present, the count in
     * figures, and the whole thing summarised for a screen reader — because
     * three coloured dots would put the entire meaning into hue, and the two
     * hues that matter most here are ΔE 0.9 apart under deuteranopia.
     */
    test('a flagged row carries a shape and a count, not a colour [alarms:I-32]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockAlarmsSlots(page, {
            byEntry: {
                [ENTRY]: [
                    ENTRY_FINDING,
                    { ...ENTRY_FINDING, ruleId: 'rule-warn', severity: 'warn' }
                ]
            }
        });
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);
        await contentLibraryPage.showChecksColumn();

        // Located by the record, not by position: the seed's first row happens
        // to be this one, and an assertion that relies on that reads a
        // different row the moment anything sorts the list.
        const flagged = await contentLibraryPage.checksCellIn(
            TABLE,
            'Title 01'
        );

        // The count, as text — a number nobody has to see a colour to read.
        await expect(flagged).toContainText('2');
        // One glyph per severity present, and the two are different *shapes*.
        // A build drawing one icon for every severity — colour doing the whole
        // job — collapses this pair into one.
        const glyphs = flagged.locator('svg');
        await expect(glyphs).toHaveCount(2);
        // Read through the Locator API rather than in the page: this project's
        // TypeScript `lib` has no DOM, so an in-page `innerHTML` is not typed.
        const shapes = await Promise.all([
            glyphs.nth(0).innerHTML(),
            glyphs.nth(1).innerHTML()
        ]);
        expect(new Set(shapes).size).toBe(2);
        // And the sentence a screen reader gets, since the glyphs are
        // deliberately `aria-hidden`.
        await expect(flagged).toContainText(ENTRY_FINDING.title);
    });

    /**
     * The entry rail's Checks block — the surface the whole feature exists for.
     */
    test('the entry rail tells checking, failed and clean apart [alarms:I-33]', async ({
        page,
        contentLibraryPage
    }) => {
        // Three states, three page loads, and a `5xx` costs the retry ladder
        // (~7s) before the query gives up — comfortably past the 30s default.
        test.setTimeout(90_000);
        // 1. Still checking.
        await mockAlarmsSlots(page, { byEntry: {}, byEntryDelayMs: 3000 });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await expect(contentLibraryPage.entryChecksSpinner).toBeVisible();
        await expect(contentLibraryPage.entryChecksSection).not.toContainText(
            'No alarm flags this record.'
        );

        // 2. Could not check — explicitly not an empty state.
        await mockAlarmsSlots(page, { byEntryFailing: true });
        await page.reload();
        await expect(contentLibraryPage.entryChecksSection).toContainText(
            'Checks could not be loaded',
            { timeout: 15_000 }
        );
        await expect(contentLibraryPage.entryChecksSection).not.toContainText(
            'No alarm flags this record.'
        );

        // 3. Checked, and clean.
        await mockAlarmsSlots(page, { byEntry: {} });
        await page.reload();
        await expect(contentLibraryPage.entryChecksSection).toContainText(
            'No alarm flags this record.'
        );
        await expect(contentLibraryPage.entryChecksSpinner).toHaveCount(0);
    });

    /**
     * What an editor is actually shown about a flagged record, and in what
     * words: the finding's own sentence, the alarm behind it, and the severity
     * spelled out beside its glyph.
     */
    test('a flagged record reads its finding beside the record [alarms:I-32]', async ({
        page,
        contentLibraryPage
    }) => {
        await mockAlarmsSlots(page, { byEntry: { [ENTRY]: [ENTRY_FINDING] } });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);

        const checks = contentLibraryPage.entryChecksSection;
        // The sentence written for whoever opens the record…
        await expect(checks).toContainText(ENTRY_FINDING.title);
        // …the alarm behind it, in the language of editorial policy, so there
        // is somewhere to start if the ask seems wrong…
        await expect(checks).toContainText(ENTRY_FINDING.ruleName);
        // …and the severity as a word, not only as a red glyph.
        await expect(checks).toContainText('Error');
    });

    /**
     * Two `enabled` clauses that are invisible on a healthy screen: a member
     * without `alarms:read` renders no block at all, and a record being created
     * has no id to have found anything about.
     */
    test('asks nothing without the permission, and nothing for a new record [alarms:I-30]', async ({
        page,
        contentLibraryPage
    }) => {
        const api = await mockAlarmsSlots(page, {
            byEntry: { [ENTRY]: [ENTRY_FINDING] }
        });

        // A record that does not exist yet: no id, so nothing to have found.
        await contentLibraryPage.gotoNewEntry(WS, TYPE);
        // Anchored on the rail the block would live in rather than on a network
        // idle: the widget is a child of it, so once the panel is painted a
        // request the widget was going to make is already in the recorder.
        await expect(contentLibraryPage.propertiesPanel).toBeVisible();
        await expect(contentLibraryPage.entryChecksSection).toHaveCount(0);
        expect(api.byEntryRequests).toEqual([]);

        // And a member who may not read alarms: no block, and no request the
        // server would only answer with a 403.
        await mockSignedIn(page, {
            permissions: ['workspaces:read', 'content:read']
        });
        await contentLibraryPage.gotoEntry(WS, TYPE, ENTRY);
        await expect(contentLibraryPage.propertiesPanel).toBeVisible();
        await expect(contentLibraryPage.entryChecksSection).toHaveCount(0);
        expect(api.byEntryRequests).toEqual([]);
    });

    /**
     * "Save as alarm" — the seam between the query builder's UI and alarms'
     * storage, and the one place a rule is actually born.
     *
     * The condition is not re-presented in the dialog and cannot be edited
     * there: it was built in the list the user is looking at. So the only
     * question worth asking is whether what the URL carried is what the POST
     * carried, byte for byte — a rule is stored **verbatim** as an entry-list
     * filter tree, and there is no second condition format anywhere in the
     * system for it to be translated into.
     */
    test('turns the list’s own filter into an alarm, unchanged [alarms:I-02]', async ({
        page,
        contentLibraryPage
    }) => {
        const FILTER = {
            and: [{ field: 'category', op: 'eq', value: 'news' }]
        };
        const api = await mockAlarmsSlots(page);

        // Without a filter there is nothing to save, and the action is absent
        // rather than disabled — a dead control with no explanation is a worse
        // answer than no control.
        await contentLibraryPage.gotoRecords(WS, TYPE);
        await expect(contentLibraryPage.recordRows(TABLE)).toHaveCount(10);
        await expect(contentLibraryPage.saveAsAlarm).toHaveCount(0);

        await page.goto(
            `/workspaces/${WS}/content/${TYPE}?filter=${encodeURIComponent(
                JSON.stringify(FILTER)
            )}`
        );
        await expect(contentLibraryPage.saveAsAlarm).toBeVisible();

        await contentLibraryPage.saveAsAlarm.click();
        await contentLibraryPage.fillSaveAlarmDialog(
            'Uncategorised news',
            'This is filed under news'
        );
        await contentLibraryPage.saveAlarmSubmit.click();

        await expect
            .poll(() => api.creates.length, { timeout: 5000 })
            .toBeGreaterThan(0);
        expect(api.creates[0]).toMatchObject({
            contentType: TYPE,
            name: 'Uncategorised news',
            findingTitle: 'This is filed under news'
        });
        // The tree from the URL, not a re-serialisation of whatever the builder
        // made of it: a round trip through the builder is a place a condition
        // can quietly change into a different one that still reads the same.
        expect(api.creates[0].filter).toEqual(FILTER);
    });
});
