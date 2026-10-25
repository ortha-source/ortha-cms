import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the full-page create-workspace wizard at `/workspaces/new`
 * (from `@orthacms/workspaces-admin`). A 3-step flow (Basics → Content →
 * People) beside a live preview of the card; the page sits behind the shell's
 * gate **and** the `workspaces:create` permission, so tests must seed both via
 * `mockSignedIn` and a workspaces mock. A create lands on
 * `/workspaces/:id/ready` (see {@link WorkspaceReadyPage}).
 */
export class CreateWorkspacePage extends BasePage {
    /** The page `<h1>`. */
    readonly heading: Locator;
    /** The top bar's "Workspaces" crumb — the page's way back to the list. */
    readonly workspacesCrumb: Locator;
    /** Basics: the workspace name input. */
    readonly nameInput: Locator;
    /** Basics: the address (slug) input, auto-filled from the name. */
    readonly slugInput: Locator;
    /** Basics: the optional description textarea. */
    readonly descriptionInput: Locator;
    /** The step's primary action on Basics and Content. */
    readonly continueButton: Locator;
    /** Basics: Cancel, back to the list. */
    readonly cancel: Locator;
    /** People: the primary action — submits the wizard. */
    readonly createButton: Locator;
    /** People: submits without the people step's additions. */
    readonly skipJustMe: Locator;
    /** The footer Back button (Content/People steps). */
    readonly back: Locator;
    /** The progress line (a labelled list of the three steps). */
    readonly progress: Locator;
    /** The live preview column (hidden from assistive tech; a picture). */
    readonly preview: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'New workspace',
            level: 1
        });
        this.workspacesCrumb = page
            .getByRole('navigation', { name: 'Breadcrumb' })
            .getByRole('link', { name: 'Workspaces', exact: true });
        this.nameInput = page.getByLabel('Workspace name');
        this.slugInput = page.getByLabel('Address');
        this.descriptionInput = page.getByLabel('Description');
        this.continueButton = page.getByRole('button', {
            name: 'Continue',
            exact: true
        });
        this.cancel = page.getByRole('link', { name: 'Cancel', exact: true });
        this.createButton = page.getByRole('button', {
            name: /^(Create workspace|Creating…)$/
        });
        this.skipJustMe = page.getByRole('button', { name: 'Skip — just me' });
        this.back = page.getByRole('button', { name: 'Back', exact: true });
        this.progress = page.getByRole('list', { name: 'Progress' });
        this.preview = page.getByTestId('workspace-preview');
    }

    async goto() {
        await this.page.goto('/workspaces/new');
        await this.heading.waitFor();
    }

    /** A color swatch in the Basics step's colour radiogroup. */
    colorSwatch(color: string): Locator {
        return this.page.getByRole('radio', {
            name: `Use the ${color} accent`
        });
    }

    /** The address availability badge text (e.g. "Available"). */
    slugStatus(text: string): Locator {
        return this.page.getByText(text, { exact: true });
    }

    /** The description's "{n} / {max}" length counter. */
    descriptionCounter(): Locator {
        return this.page.getByText(/^\d+ \/ 2000$/);
    }

    /** A field-level validation message anywhere in the step. */
    fieldError(message: string): Locator {
        return this.page.getByText(message);
    }

    /**
     * The address field's "we couldn't answer that" state — the availability
     * endpoint failed, so uniqueness is unknown and the step stays blocked. A
     * `role="alert"`, unlike the passive Checking/Available badge.
     */
    slugCheckFailed(): Locator {
        return this.page.getByRole('alert').filter({
            hasText: /Couldn’t check whether this address is free/
        });
    }

    /** A sonner toast by text (failure of the submit). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** A step on the progress line, by its accessible name. */
    progressStep(name: string | RegExp): Locator {
        return this.progress.getByRole('button', { name });
    }

    /** People step: the directory search box (an ARIA combobox). */
    get memberSearch(): Locator {
        return this.page.getByRole('combobox', {
            name: 'Add people by name or email'
        });
    }

    /** A result in the members typeahead's listbox. */
    memberOption(name: string | RegExp): Locator {
        return this.page.getByRole('option', { name });
    }

    /** People step: the "People with access" list. */
    get peopleList(): Locator {
        return this.page.getByRole('list', { name: 'People with access' });
    }

    /** People step: one person's row, by name or address. */
    person(name: string | RegExp): Locator {
        return this.peopleList.getByRole('listitem').filter({ hasText: name });
    }

    /** The step's `<h2>` — the focus target after a step change. */
    stepHeading(name: string): Locator {
        return this.page.getByRole('heading', { name, level: 2 });
    }

    /** Content step: the "Everything" answer. */
    get everythingTile(): Locator {
        return this.page.getByRole('radio', { name: 'Everything' });
    }

    /** Content step: the "Pick content types" answer. */
    get specificContentTile(): Locator {
        return this.page.getByRole('radio', { name: 'Pick content types' });
    }

    /** Content step: one of this workspace's own types, by label. */
    contentCheckbox(label: string): Locator {
        return this.page.getByRole('checkbox', { name: label, exact: true });
    }

    /** Content step: a section of the one list ("Collections", "Pages"). */
    contentSection(name: string): Locator {
        return this.page.getByRole('group', { name, exact: true });
    }

    /** Content step: the "From shared workspaces" section. */
    sharedContentSection(): Locator {
        return this.page.getByRole('group', {
            name: 'From shared workspaces'
        });
    }

    /** Content step: one shared type's checkbox, "{Type} from {Workspace}". */
    sharedContentCheckbox(label: string, workspaceName: string): Locator {
        return this.page.getByRole('checkbox', {
            name: `${label} from ${workspaceName}`,
            exact: true
        });
    }

    /** Fill the name and continue to the Content step. */
    async toContentStep(name: string) {
        await this.nameInput.fill(name);
        await this.continueButton.click();
        await this.stepHeading('What can people write here?').waitFor();
    }

    /** Fill the name and walk on to the People step. */
    async toPeopleStep(name: string) {
        await this.toContentStep(name);
        await this.continueButton.click();
        await this.stepHeading('Who works here?').waitFor();
    }

    /**
     * Walk the wizard with the defaults — Everything, just the creator —
     * submitting at the end. The first `continueButton.click()` auto-waits
     * for the address check to enable it.
     */
    async create(name: string) {
        await this.toPeopleStep(name);
        await this.createButton.click();
    }
}
