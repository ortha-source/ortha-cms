import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the **skills management page** — `/workspaces/:id/agents/skills`,
 * where a workspace's skills are authored.
 *
 * Inside the Agents view rather than a global settings area, because everything
 * the copilot owns is workspace-scoped. Reached from the thread rail's footer,
 * and only by someone holding `copilot:skills:manage`.
 */
export class CopilotSkillsPage extends BasePage {
    /** The shell's inset — the page, and nothing portalled over it. */
    readonly main: Locator;

    constructor(page: Page) {
        super(page);
        this.main = page.getByRole('main');
    }

    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/agents/skills`);
    }

    /** The page heading. */
    heading(): Locator {
        return this.main.getByRole('heading', { name: 'Skills', level: 1 });
    }

    /** The "no access" state a role without the permission gets. */
    forbidden(): Locator {
        return this.main.getByRole('alert').filter({ hasText: 'No access' });
    }

    /** The table of skills. Absent while the workspace has none. */
    table(): Locator {
        return this.main.getByRole('table');
    }

    /** One row, found by the skill's title. */
    row(title: string): Locator {
        return this.table().getByRole('row').filter({ hasText: title });
    }

    /** The empty state. */
    empty(): Locator {
        return this.main.getByText('No skills yet');
    }

    // --- the form dialog --------------------------------------------------

    /** Opens the create form. */
    newSkill(): Locator {
        return this.main.getByRole('button', { name: 'New skill' });
    }

    /** Opens a row's edit form. */
    editSkill(title: string): Locator {
        return this.main.getByRole('button', { name: `Edit ${title}` });
    }

    /** Opens a row's delete confirmation. */
    deleteSkill(title: string): Locator {
        return this.main.getByRole('button', { name: `Delete ${title}` });
    }

    /** The create/edit dialog. */
    dialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** One of the dialog's fields, by its visible label. */
    field(label: string): Locator {
        return this.dialog().getByLabel(label);
    }

    /** The dialog's Save button. */
    save(): Locator {
        return this.dialog().getByRole('button', { name: /Save|Saving/ });
    }

    /** The reason the server refused a save, shown in the dialog. */
    formError(): Locator {
        return this.dialog().getByRole('alert');
    }

    /** The delete confirmation's own confirm button. */
    confirmDelete(): Locator {
        return this.page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' });
    }

    /**
     * Fill the create form and submit it.
     *
     * The identifier is left alone: it follows the name while creating, which
     * is the behaviour worth exercising here rather than routing around.
     */
    async createSkill(values: {
        title: string;
        description: string;
        instructions: string;
    }) {
        await this.newSkill().click();
        await this.dialog().waitFor();
        await this.field('Name').fill(values.title);
        await this.field('When to use it').fill(values.description);
        await this.field('Instructions').fill(values.instructions);
        await this.save().click();
    }
}
