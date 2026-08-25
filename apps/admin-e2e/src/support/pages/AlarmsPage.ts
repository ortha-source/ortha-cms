import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for content alarms — the workspace page at
 * `/workspaces/:id/alarms` and the rule editor at `.../alarms/rules/:ruleId`
 * (from `@orthacms/alarms-admin`). Seed it with `mockSignedIn`,
 * `mockWorkspaces` and `mockAlarmsApi`.
 *
 * Locators go through roles and visible text throughout: the condition editor's
 * defect was that it *looked* right, so a suite that reached for test ids would
 * have reproduced the same blind spot in a different language.
 */
export class AlarmsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** Navigate to a workspace's alarms page. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/alarms`);
    }

    /** Navigate straight to the create form. */
    async gotoNewRule(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/alarms/rules/new`);
    }

    /** The alarms page's "New alarm" action. */
    newAlarmButton(): Locator {
        return this.page.getByRole('button', { name: 'New alarm' });
    }

    /** Pick the collection the alarm watches (create form only). */
    async chooseContentType(label: string) {
        await this.page
            .getByRole('combobox', { name: 'What to watch' })
            .click();
        await this.page.getByRole('option', { name: label }).click();
    }

    /** Fill the alarm's name. */
    async fillAlarmName(value: string) {
        await this.page.getByLabel('Alarm name').fill(value);
    }

    /** Fill what editors will see on a flagged record. */
    async fillFindingTitle(value: string) {
        await this.page.getByLabel('What editors will see').fill(value);
    }

    /** Navigate straight to one rule's editor. */
    async gotoRule(workspaceId: string, ruleId: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/alarms/rules/${ruleId}`
        );
    }

    /** The page heading. */
    heading(): Locator {
        return this.page.getByRole('heading', { name: 'Alarms', level: 1 });
    }

    // --- the page-context bar (the chrome every other section carries) ---

    /** The breadcrumb trail in the page top bar. */
    breadcrumb(): Locator {
        return this.page.getByRole('navigation', { name: 'Breadcrumb' });
    }

    /** A breadcrumb link by label — the way back to the list. */
    breadcrumbLink(label: string): Locator {
        return this.breadcrumb().getByRole('link', { name: label });
    }

    /** The trail's current-page crumb. */
    breadcrumbCurrent(label: string): Locator {
        return this.breadcrumb().getByText(label, { exact: true });
    }

    // --- the three tabs ---

    /** One of the Flagged / Muted / Rules tabs. */
    tab(name: 'Flagged' | 'Muted' | 'Rules'): Locator {
        // A `radiogroup`, not a `group`: the design system's SegmentedControl
        // is a Radix ToggleGroup in single-select mode, so the items are radios
        // and the container takes the matching role.
        return this.page
            .getByRole('radiogroup', { name: 'Alarms view' })
            .getByRole('radio', { name: new RegExp(`^${name}`) });
    }

    // --- findings, grouped by alarm ---

    /** One alarm's collapsible group header, by the alarm's name. */
    group(name: string): Locator {
        return this.page.getByRole('button', {
            name: new RegExp(`^${name} — `)
        });
    }

    /** Expand one alarm's group. */
    async openGroup(name: string) {
        await this.group(name).click();
    }

    /** The records list inside one alarm's group. */
    groupList(name: string): Locator {
        return this.page.getByRole('list', {
            name: `Records flagged by ${name}`
        });
    }

    /** One record row inside a group, by any text it shows. */
    groupRow(name: string, text: string): Locator {
        return this.groupList(name)
            .getByRole('listitem')
            .filter({ hasText: text });
    }

    /** The Mute button on one finding's row. */
    muteButton(title: string): Locator {
        return this.page.getByRole('button', {
            name: `Mute “${title}” on this record`
        });
    }

    /** The centred empty state's heading. */
    emptyHeading(text: string): Locator {
        return this.page.getByRole('heading', { name: text, level: 2 });
    }

    // --- the mute dialog (this used to be a `window.prompt`) ---

    /** The mute dialog. */
    muteDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Mute this check' });
    }

    /** The reason field inside it. */
    muteReason(): Locator {
        return this.muteDialog().getByLabel('Why is this one fine?');
    }

    /** The dialog's confirming button. */
    muteConfirm(): Locator {
        return this.muteDialog().getByRole('button', { name: 'Mute' });
    }

    // --- the rule editor's condition block ---

    /** The condition panel's heading. */
    conditionHeading(): Locator {
        return this.page.getByRole('heading', { name: 'Flag a record when…' });
    }

    /** The Edit conditions / Done editing toggle. */
    conditionToggle(): Locator {
        return this.page.getByRole('button', {
            name: /Edit conditions|Done editing/
        });
    }

    /**
     * The query-builder region the toggle controls.
     *
     * Overriding `filterSurface` is what the base class is built for — the
     * editor mounts the builder as an inline panel rather than the drawer, so
     * every shared helper (`applyButton`, `addRule`, `selectField`,
     * `filterFieldsError`) works here unchanged.
     */
    override filterSurface(): Locator {
        return this.page.getByRole('region', {
            name: /Edit conditions|Done editing/
        });
    }

    /** Alias, for specs that read better naming the thing rather than the role. */
    conditionPanel(): Locator {
        return this.filterSurface();
    }

    /**
     * One committed condition, as a summary chip.
     *
     * This is the read-out that makes Apply visible: before it existed,
     * committing a condition changed nothing on screen.
     */
    conditionChip(text: string | RegExp): Locator {
        return this.page
            .locator('span')
            .filter({ has: this.page.locator('[data-qb-chip-remove]') })
            .filter({ hasText: text });
    }

    /** Every committed condition chip. */
    conditionChips(): Locator {
        return this.page
            .locator('span')
            .filter({ has: this.page.locator('[data-qb-chip-remove]') });
    }

    /** Drop every committed condition via the summary's own "Clear all". */
    async clearAllConditions() {
        await this.page.getByRole('button', { name: 'Clear all' }).click();
    }

    /** The live "N records match" read-out under the conditions. */
    matchCount(): Locator {
        return this.page.getByText(/record[s]? match|No records match/);
    }

    /** The notice that says the conditions on screen are not saved yet. */
    unsavedNotice(): Locator {
        return this.page.getByText(
            'Conditions changed. Nothing is flagged or cleared until you save.'
        );
    }

    /**
     * The editor's committing button — "Save changes" when editing, "Create
     * alarm" on the create form. One locator, because every assertion about it
     * is about the same thing: whether the form can be committed.
     */
    saveButton(): Locator {
        return this.page.getByRole('button', {
            name: /Save changes|Create alarm/
        });
    }

    /**
     * The panel's loading state while the filterable-field surface is in
     * flight. `filterFieldsError` (the failed case) comes from `BasePage`.
     */
    fieldsLoading(): Locator {
        return this.page.getByText('Loading filterable fields…');
    }
}
