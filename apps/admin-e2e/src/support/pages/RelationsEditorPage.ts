import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Escape a record title for use inside a name `RegExp`. */
function rx(text: string): RegExp {
    return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/**
 * Page object for the entry editor's **Relations** tab and its relation picker
 * (from `@ortha-cms/content-admin`). Drives the create editor at
 * `/workspaces/:id/content/article/new`. Seed with `mockSignedIn`,
 * `mockWorkspaces`, and the `RELATIONS_*` content mocks; candidate rows are baked
 * into the app, so the picker needs only the target schema mocked.
 */
export class RelationsEditorPage extends BasePage {
    /** The editor's Relations tab trigger. */
    readonly relationsTab: Locator;
    /** The open relation picker dialog (title starts "Assign …"). */
    readonly dialog: Locator;

    constructor(page: Page) {
        super(page);
        this.relationsTab = page.getByRole('tab', { name: 'Relations' });
        this.dialog = page.getByRole('dialog', { name: /^Assign / });
    }

    /** Open the create editor for the seeded `article` collection. */
    async gotoNewArticle(workspaceId: string) {
        await this.gotoNewType(workspaceId, 'article');
    }

    /** Open the create editor for any collection by machine name. */
    async gotoNewType(workspaceId: string, typeName: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/content/${typeName}/new`
        );
    }

    /** Switch to the Relations tab. */
    async openRelationsTab() {
        await this.relationsTab.click();
    }

    /** A relation field's card heading (an exact-match `heading` by its label). */
    section(label: string): Locator {
        return this.page.getByRole('heading', { name: label });
    }

    /** The "Select {label}" trigger of an empty single relation. */
    selectButton(targetLabel: string): Locator {
        return this.page.getByRole('button', { name: `Select ${targetLabel}` });
    }

    /** The "Add related" trigger of a many relation. */
    get addRelatedButton(): Locator {
        return this.page.getByRole('button', { name: 'Add related' });
    }

    /** The picker's search box. */
    get dialogSearch(): Locator {
        return this.dialog.getByRole('textbox', { name: /Search/ });
    }

    /** The picker's query-builder "Filters" disclosure toggle. */
    get filtersButton(): Locator {
        return this.dialog.getByRole('button', { name: /Filters/ });
    }

    /** The inline query-builder's "Add rule" button — visible once Filters is open. */
    get addRuleButton(): Locator {
        return this.dialog.getByRole('button', { name: 'Add rule' });
    }

    /**
     * Every candidate row currently rendered (a checkbox per row for a
     * many-relation; used to assert lazy-scroll growth and search narrowing).
     */
    get candidateOptions(): Locator {
        return this.dialog.getByRole('checkbox');
    }

    /** One candidate row by its (record title) text — checkbox (many) or radio (single). */
    candidate(title: string): Locator {
        return this.dialog
            .getByRole('checkbox', { name: rx(title) })
            .or(this.dialog.getByRole('radio', { name: rx(title) }));
    }

    /**
     * Scroll the candidate list down — trips the lazy-load near-bottom handler.
     * Hovers the last rendered row so the wheel targets the list's scroll
     * container, then wheels down.
     */
    async scrollCandidatesToBottom() {
        await this.candidateOptions.last().hover();
        await this.page.mouse.wheel(0, 1200);
    }

    /** Only the candidate rows currently checked. */
    get checkedCandidateOptions(): Locator {
        return this.dialog.getByRole('checkbox', { checked: true });
    }

    /**
     * The picker's bulk toggle. Reads "Select all {n}" until every *loaded*
     * candidate is checked, then "Clear selection" — the list is lazily
     * paginated, so it only ever covers what has been fetched.
     */
    get selectAllButton(): Locator {
        return this.dialog.getByRole('button', {
            name: /Select all \d+|Clear selection/
        });
    }

    /** The picker's "Add {n}" commit button (many relations). */
    get addSelectedButton(): Locator {
        return this.dialog.getByRole('button', { name: /^Add \d/ });
    }

    /** The picker's Cancel button. */
    get cancelButton(): Locator {
        return this.dialog.getByRole('button', { name: 'Cancel' });
    }

    /** The picker's "{n} records" count line. */
    get recordsCount(): Locator {
        return this.dialog.getByText(/\d+ records?/);
    }

    /** The remove (✕) control of an assigned record — proves it's linked. */
    assignedRemove(title: string): Locator {
        return this.page.getByRole('button', { name: `Remove ${title}` });
    }

    /** The drag handle of an assigned record (many relations, reorderable). */
    dragHandle(title: string): Locator {
        return this.page.getByRole('button', { name: `Reorder ${title}` });
    }

    /** The "Replace" action on an assigned single relation's row. */
    get replaceButton(): Locator {
        return this.page.getByRole('button', { name: 'Replace' });
    }

    /** The up-arrow reorder control of an assigned record (ordered many relations). */
    moveUp(title: string): Locator {
        return this.page.getByRole('button', { name: `Move ${title} up` });
    }

    /** The down-arrow reorder control of an assigned record (ordered many relations). */
    moveDown(title: string): Locator {
        return this.page.getByRole('button', { name: `Move ${title} down` });
    }

    /** The muted `/handle` shown on an assigned/linked row (exact match). */
    recordHandle(slug: string): Locator {
        return this.page.getByText(`/${slug}`, { exact: true });
    }

    /** The "open in a new tab" link of an assigned record (the preview row). */
    openLink(title: string): Locator {
        return this.page.getByRole('link', {
            name: `Open ${title} in a new tab`
        });
    }

    /** The "open in a new tab" link of a candidate row (the picker/search window). */
    candidateOpenLink(title: string): Locator {
        return this.dialog.getByRole('link', {
            name: `Open ${title} in a new tab`
        });
    }

    /** The "Nothing linked yet." empty text for a relation field. */
    get nothingLinked(): Locator {
        return this.page.getByText('Nothing linked yet.');
    }

    /** The yellow "Changed" badge shown on an edited field / relation section. */
    get changedBadge(): Locator {
        return this.page.getByText('Changed', { exact: true });
    }

    /**
     * Save the entry **as a draft** — opens the editor's ⋯ actions menu and picks
     * "Save draft" (the relaxed, no-publish save), so a save fires without the
     * publish gate blocking on empty required fields.
     */
    async saveDraft() {
        await this.page.getByRole('button', { name: 'More actions' }).click();
        await this.page.getByRole('menuitem', { name: 'Save draft' }).click();
    }
}
