import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Content Library at `/workspaces/:id/content` (from
 * `@ortha-cms/content-admin`) — the second-sidebar nav (collapsible Collections
 * and Pages groups, a Favorites section), the ⌘K search palette, and the
 * selected-type pane. Seed it with
 * `mockSignedIn`, `mockWorkspaces`, and `mockContentSchema`.
 */
export class ContentLibraryPage extends BasePage {
    /** The second sidebar nav region. */
    readonly sidebar: Locator;
    /**
     * The content library's own second-sidebar search trigger (opens its
     * collections/pages palette). Distinct from the global shell command palette
     * (`BasePage.searchTrigger()`), so it carries its own name.
     */
    readonly contentSearchTrigger: Locator;
    /** The command palette dialog. */
    readonly searchDialog: Locator;
    /** The palette's search input. */
    readonly searchInput: Locator;

    constructor(page: Page) {
        super(page);
        this.sidebar = page.getByRole('navigation', { name: 'Content types' });
        this.contentSearchTrigger = this.sidebar.getByRole('button', {
            name: /Search/
        });
        this.searchDialog = page.getByRole('dialog');
        this.searchInput = page.getByPlaceholder(
            'Search collections and pages…'
        );
    }

    /** Navigate straight to a workspace's Content Library. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/content`);
    }

    /** Navigate straight to one entry's editor (`/content/:type/:id`). */
    async gotoEntry(workspaceId: string, typeName: string, id: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/content/${typeName}/${id}`
        );
    }

    /** An entry-editor tab trigger by label ("General" / "History"). */
    editorTab(name: string): Locator {
        return this.page.getByRole('tab', { name });
    }

    /** Open one entry-editor tab. */
    async openEditorTab(name: string) {
        await this.editorTab(name).click();
    }

    /**
     * The active editor tabpanel — the History tab renders the full revision
     * timeline (the sidebar widget shows a compact copy, so scope revision
     * assertions to this panel to avoid matching both).
     */
    get editorTabPanel(): Locator {
        return this.page.getByRole('tabpanel');
    }

    /** The History timeline's `<li>` for version `n` (scoped to the tab panel). */
    revisionItem(n: number): Locator {
        return this.editorTabPanel
            .getByRole('listitem')
            .filter({ has: this.page.getByText(`v${n}`, { exact: true }) });
    }

    /** Every "Live" status badge in the History timeline. */
    get liveRevisionBadges(): Locator {
        return this.editorTabPanel.getByText('Live', { exact: true });
    }

    /** The History-row "Publish version {n}" action (scoped to the tab panel). */
    revisionPublish(n: number): Locator {
        return this.editorTabPanel.getByRole('button', {
            name: `Publish version ${n}`
        });
    }

    /** The confirm button inside the publish-version confirmation dialog. */
    get confirmPublishButton(): Locator {
        return this.page
            .getByRole('dialog')
            .getByRole('button', { name: 'Publish', exact: true });
    }

    /** Publish revision `n` from the History timeline (row action + confirm). */
    async publishRevision(n: number) {
        await this.revisionPublish(n).click();
        await this.confirmPublishButton.click();
    }

    /**
     * The records page mounts the query builder as an **inline accordion panel**
     * (a `region` labelled by the "Filters" toggle), not the modal drawer the
     * other list pages use — so override the shared filter helpers' surface.
     */
    override filterSurface(): Locator {
        return this.page.getByRole('region', { name: /Filters/ });
    }

    /**
     * Collapse the inline filter panel. The panel stays open after Apply (so
     * further edits don't need a re-open), and the applied-conditions summary
     * only renders while it's collapsed — so a summary assertion has to close
     * it first.
     */
    async closeFilters() {
        await this.filterTrigger().click();
        await expect(this.filterTrigger()).toHaveAttribute(
            'aria-expanded',
            'false'
        );
    }

    /**
     * One chip in the collapsed filter summary, matched on its readable text
     * ("Author · Name contains Ada"). The chip is the resting read-out of an
     * applied condition; removing it re-commits the narrowed tree at once.
     */
    filterChip(text: string | RegExp): Locator {
        return this.page.getByTitle(text);
    }

    /**
     * Remove one applied condition from the summary. `label` is the chip's
     * "<path> <operator>" text — the remove button's accessible name is
     * "Remove condition <path> <operator>".
     */
    async removeFilterChip(label: string) {
        await this.page
            .getByRole('button', { name: `Remove condition ${label}` })
            .click();
    }

    /** Drop every applied condition from the summary in one action. */
    async clearAllFilters() {
        await this.page.getByRole('button', { name: 'Clear all' }).click();
    }

    /**
     * The relation-id value editor — a record picker rather than a raw uuid
     * input. It is the rule's **third** combobox (field, operator, value); like
     * the other two its trigger is `role="combobox"`, not a plain button.
     */
    async openRelationValuePicker() {
        await this.filterSurface().getByRole('combobox').nth(2).click();
    }

    /** Toggle one record in the open relation value picker, by its title. */
    async pickRelationRecord(title: string) {
        await this.page
            .getByRole('option', { name: title, exact: true })
            .click();
    }

    /** A collapsible group trigger by label ("Collections" / "Pages"). */
    group(label: string): Locator {
        return this.sidebar.getByRole('button', {
            name: new RegExp(`^${label}`)
        });
    }

    /**
     * Expand a collapsible group, **idempotently**. The Collections group is
     * open by default (and the group holding a deep-linked type auto-opens), so
     * a bare click would *collapse* an already-open group. Read `aria-expanded`
     * and only click when it's collapsed, then wait until it has settled open so
     * the caller can interact with its rows.
     */
    async expandGroup(label: string) {
        const trigger = this.group(label);
        await trigger.waitFor();
        if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
            await trigger.click();
        }
        await this.group(label)
            .and(this.page.locator('[aria-expanded="true"]'))
            .waitFor();
    }

    /** A category label in the sidebar ("Favorites" / "Workspace Content"). */
    sectionLabel(label: string): Locator {
        return this.sidebar.getByText(label, { exact: true });
    }

    /** A content-type row link by its label. */
    typeLink(label: string): Locator {
        return this.sidebar.getByRole('link', { name: label, exact: true });
    }

    /** The pin / unpin toggle for a type row. */
    pinToggle(label: string, pinned = false): Locator {
        return this.sidebar.getByRole('button', {
            name: `${pinned ? 'Unpin' : 'Pin'} ${label}`
        });
    }

    /** Open the search palette via its trigger button. */
    async openSearch() {
        await this.contentSearchTrigger.click();
        await this.searchDialog.waitFor();
    }

    /** Open the search palette via the Ctrl/⌘+K shortcut. */
    async openSearchByShortcut() {
        // Give the page DOM focus first (just-loaded viewports aren't focused,
        // so a bare keypress wouldn't reach the window-level shortcut listener).
        // Focusing the trigger doesn't open the palette — only the shortcut does.
        await this.contentSearchTrigger.focus();
        await this.page.keyboard.press('Control+k');
        await this.searchDialog.waitFor();
    }

    /** A result option in the open palette. */
    searchOption(label: string): Locator {
        return this.searchDialog.getByRole('option', {
            name: new RegExp(label)
        });
    }

    /** The selected-type pane heading. */
    viewHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, level: 1 });
    }

    /** The collection records table (by its `{label} records` aria-label). */
    recordsTable(label: string): Locator {
        return this.page.getByRole('table', {
            name: new RegExp(`${label} records`)
        });
    }

    /** The data rows of the records table (excludes the header row). */
    recordRows(label: string): Locator {
        return this.recordsTable(label).locator('tbody tr');
    }

    /**
     * The cells of one body column, by 1-based `<td>` position (the leading
     * selection checkbox is column 1, so the first data column is 2).
     */
    recordColumnCells(label: string, nthChild: number): Locator {
        return this.recordRows(label).locator(`td:nth-child(${nthChild})`);
    }

    /**
     * A record's own editor link — the `<Link>` wrapping the first column's
     * cell. Prefer this over clicking the row when the table has relation
     * columns: those cells `stopPropagation`, so a centred row click can land on
     * one and never navigate.
     */
    recordLink(title: string): Locator {
        return this.page.getByRole('link', { name: title, exact: true });
    }

    /** The records search box. */
    get recordsSearch(): Locator {
        return this.page.getByRole('searchbox', { name: 'Search records' });
    }

    /** The "Add record" action in the records header. */
    get addRecord(): Locator {
        return this.page.getByRole('button', { name: 'Add record' });
    }

    /** The entry editor's primary action button (label varies by type/state). */
    get editorSave(): Locator {
        return this.page.getByRole('button', {
            name: /^(Save|Save draft|Save & publish|Publish)$/
        });
    }

    /** The entry editor's "Back to records" link (present when editing a row). */
    get editorBackLink(): Locator {
        return this.page.getByRole('link', { name: 'Back to records' });
    }

    /**
     * A form field's text input by its label.
     *
     * Pass `exact` when the type has labels that are substrings of one another
     * — Playwright's `name` match is a case-insensitive **substring** by
     * default, so a "Title" field and a "Subtitle" field are two hits for
     * `'Title'` and the locator fails strict mode.
     */
    fieldTextbox(label: string, { exact = false } = {}): Locator {
        return this.page.getByRole('textbox', { name: label, exact });
    }

    /**
     * A form field's **numeric** input by its label. A `number`/`money` field
     * renders `<input type="number">`, which carries the `spinbutton` role — not
     * `textbox` — so it needs its own handle.
     */
    fieldSpinbutton(label: string): Locator {
        return this.page.getByRole('spinbutton', { name: label });
    }

    /**
     * A `date`/`datetime` field's trigger button, by the field's machine name.
     * Its text is the formatted value, so asserting on it checks what the user
     * actually reads off the control.
     */
    dateFieldTrigger(fieldName: string): Locator {
        return this.page.locator(`#entry-field-${fieldName}`);
    }

    /** A form field's `<label>` element, by the field's machine name. */
    fieldLabel(fieldName: string): Locator {
        return this.page.locator(`label[for="entry-field-${fieldName}"]`);
    }

    /** Navigate straight to a **single** (page) type's editor, which is the type
     * route itself — a page has one row, so there is no records table in front
     * of it. */
    async gotoSingle(workspaceId: string, typeName: string) {
        await this.page.goto(`/workspaces/${workspaceId}/content/${typeName}`);
    }

    /** The banner shown over a read-only entry editor. */
    get readOnlyNotice(): Locator {
        return this.page.getByText('View only', { exact: true });
    }

    /**
     * The control carrying a field's id — a `select`'s trigger, a date field's
     * button. Located by id rather than by role because the assertion these
     * serve is about the element's *disabled* state, and a handle that resolves
     * in both states is what lets a test assert the transition instead of the
     * element simply vanishing.
     */
    fieldTrigger(fieldName: string): Locator {
        return this.page.locator(`#entry-field-${fieldName}`);
    }

    /**
     * The buttons of a `boolean` field's segmented control, scoped by the
     * `aria-labelledby` the entry form puts on the group — so two booleans on
     * one type never collide. Anchored on that rather than on a role, because
     * the design-system control is a Radix toggle group whose role mapping is
     * its own business and not something a test should encode.
     */
    booleanSegments(fieldName: string): Locator {
        return this.page
            .locator(`[aria-labelledby="entry-field-${fieldName}-label"]`)
            .locator('button');
    }

    /** The "Localized field" tooltip trigger inside a field's label row. */
    get localizedMark(): Locator {
        return this.page.getByRole('button', { name: 'Localized field' });
    }

    /** A General-tab field-group heading ("Translated fields" / "Shared fields"). */
    fieldGroupHeading(title: string): Locator {
        return this.page.getByRole('heading', { name: title, exact: true });
    }

    /** The "Localized relation" mark on a relation section header. */
    get localizedRelationMark(): Locator {
        return this.page.getByRole('button', { name: 'Localized relation' });
    }

    /** The open tooltip bubble, wherever it is portalled. */
    get tooltip(): Locator {
        return this.page.getByRole('tooltip');
    }

    /** A field's inline validation message (design-system `FieldError`). */
    fieldError(message: string | RegExp): Locator {
        return this.page.getByRole('alert').filter({ hasText: message });
    }

    /** Navigate straight to a type's create form (`/content/:type/new`). */
    async gotoNewEntry(workspaceId: string, typeName: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/content/${typeName}/new`
        );
    }

    /** A toast message (sonner, portaled to the body). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** Save the entry **as a draft** (the ⋯ actions menu → "Save draft"). */
    async saveDraft(): Promise<void> {
        await this.openEditorMenu();
        await this.page.getByRole('menuitem', { name: 'Save draft' }).click();
    }

    /** Open the entry editor's ⋯ actions menu (in the page top bar). */
    async openEditorMenu(): Promise<void> {
        await this.page.getByRole('button', { name: 'More actions' }).click();
    }

    /** The open ⋯ menu's items, in order — the menu must already be open. */
    get editorMenuItems(): Locator {
        return this.page.getByRole('menu').getByRole('menuitem');
    }

    /**
     * How many rules the open ⋯ menu draws. The menu is laid out in groups
     * (save / publish / extras / danger) with one separator between adjacent
     * non-empty groups, so this is the group count minus one.
     */
    get editorMenuSeparators(): Locator {
        return this.page.getByRole('menu').getByRole('separator');
    }

    /**
     * Pick an item from the open ⋯ menu by label. A string match is **exact**:
     * the menu holds both "Publish all locales" and "Unpublish all locales", and
     * Playwright's default substring match resolves the former to both.
     */
    async chooseEditorAction(label: string | RegExp): Promise<void> {
        await this.page
            .getByRole('menuitem', {
                name: label,
                exact: typeof label === 'string'
            })
            .click();
    }

    /** The publish pre-flight dialog (bulk publish, and "publish all locales"). */
    get preflightDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /**
     * One pre-flight row by the name it renders under — the record's title in
     * the records table's bulk publish, the **locale** name when the dialog is
     * listing a record's siblings.
     */
    preflightRow(name: string | RegExp): Locator {
        return this.preflightDialog
            .getByRole('listitem')
            .filter({ hasText: name });
    }

    /** The pre-flight's confirm button ("Publish {n} valid"). */
    get preflightConfirm(): Locator {
        return this.preflightDialog.getByRole('button', {
            name: /^Publish \d+ valid$/
        });
    }

    /** The "Changes saved." success toast after an edit save. */
    get savedToast(): Locator {
        return this.page.getByText('Changes saved.', { exact: true });
    }

    /** The column-picker trigger. */
    get columnsButton(): Locator {
        return this.page.getByRole('button', { name: 'Columns' });
    }

    /** A column-picker checkbox option by its label. */
    columnOption(label: string): Locator {
        return this.page.getByRole('checkbox', { name: label, exact: true });
    }

    /** The column-picker's search box. */
    get columnSearch(): Locator {
        return this.page.getByRole('textbox', { name: 'Search columns' });
    }

    /** The column-picker's "no column found" empty state. */
    get columnSearchEmpty(): Locator {
        return this.page.getByText('No column found.', { exact: true });
    }

    /** A column header cell in the records table by label. */
    columnHeader(table: string, label: string): Locator {
        return this.recordsTable(table).getByRole('columnheader', {
            name: label
        });
    }

    /** The sort button inside a column header, by the column's label. */
    sortHeader(label: string): Locator {
        return this.page.getByRole('button', { name: `Sort by ${label}` });
    }

    /** The filter-drawer trigger ("Filters" / "Filters (N)"). */
    get filtersButton(): Locator {
        return this.page.getByRole('button', { name: /Filters/ });
    }

    /** The records pagination "Next page" control. */
    get nextPage(): Locator {
        return this.page.getByRole('button', { name: 'Next page' });
    }

    /** The records empty/no-match title. */
    get noRecordsMatch(): Locator {
        return this.page.getByText('No records match');
    }

    /** Every column header in the records table (incl. the leading checkbox). */
    columnHeaders(table: string): Locator {
        return this.recordsTable(table).getByRole('columnheader');
    }

    /** The drag handle for a column row in the column picker, used to reorder it. */
    reorderHandle(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Reorder ${label} column`
        });
    }

    /** The header select-all checkbox. */
    get selectAll(): Locator {
        return this.page.getByRole('checkbox', {
            name: 'Select all rows on this page'
        });
    }

    /** The selection checkbox in a given data row. */
    rowCheckbox(table: string, index: number): Locator {
        // Each data row carries exactly one checkbox; its accessible name is the
        // row's own label ("Select <first field value>"), so match by role.
        return this.recordRows(table).nth(index).getByRole('checkbox');
    }

    /** The row-actions menu trigger (kebab) in a given data row. */
    rowActions(table: string, index: number): Locator {
        return this.recordRows(table)
            .nth(index)
            .getByRole('button', { name: 'Actions for this record' });
    }

    /** A row-actions menu item by its label (the menu must be open). */
    actionItem(label: string | RegExp): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    /** The "{n} selected" count text in the selection bar. */
    get selectionCount(): Locator {
        return this.page.getByText(/\d+ selected/);
    }

    /** The selection bar's Clear button. */
    get clearSelection(): Locator {
        return this.page.getByRole('button', { name: 'Clear' });
    }

    /** Visible text in the selected-type / placeholder pane. */
    paneText(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** The "no content types" empty-state title. */
    get emptyTitle(): Locator {
        return this.page.getByText('No content types yet');
    }

    /** The load-error title. */
    get errorTitle(): Locator {
        return this.page.getByText('Couldn’t load content types');
    }

    /** The error state's retry button. */
    get retry(): Locator {
        return this.page.getByRole('button', { name: 'Try again' });
    }

    // --- i18n (from @ortha-cms/i18n-admin, via the content library slots) ---

    /** The records-toolbar locale switcher trigger (label reads "Locale: {name}"). */
    get localeSwitcher(): Locator {
        return this.page.getByRole('button', { name: /^Locale: / });
    }

    /** A locale option inside the open switcher popover. */
    localeOption(name: string | RegExp): Locator {
        return this.page.getByRole('option', { name });
    }

    /** Open the locale switcher and pick a locale by its option name. */
    async selectLocale(name: string | RegExp) {
        await this.localeSwitcher.click();
        await this.localeOption(name).click();
    }

    /** The transient "Switching to …" overlay shown while a locale switch plays. */
    get localeSwitchOverlay(): Locator {
        return this.page.getByText(/Switching to/);
    }

    /** The entry editor's locale switcher (sidebar widget) title text. */
    get localeWidget(): Locator {
        return this.page.getByText('Locale', { exact: true });
    }

    /** The widget's "Translation group" label. */
    get localeGroupLabel(): Locator {
        return this.page.getByText('Translation group', { exact: true });
    }

    /** The info tooltip trigger beside the translation-group id. */
    get localeGroupHelp(): Locator {
        return this.page.getByRole('button', {
            name: 'What is the translation group?'
        });
    }

    /** The translation-group id value shown in the widget. */
    localeGroupId(id: string): Locator {
        return this.page.getByText(id, { exact: true });
    }

    /** The current-locale chip beside the entry-editor title (aria-labelled). */
    get editorTitleChip(): Locator {
        return this.page.getByLabel(/Current locale/);
    }

    /** The switch-to-create control for a not-yet-translated locale in the widget. */
    createTranslation(localeName: string): Locator {
        return this.page.getByRole('button', {
            name: `Create the ${localeName} translation`
        });
    }

    /** The switch control for an existing sibling locale in the widget. */
    switchLocale(localeName: string): Locator {
        return this.page.getByRole('button', {
            name: `Switch to the ${localeName} version`
        });
    }
}
