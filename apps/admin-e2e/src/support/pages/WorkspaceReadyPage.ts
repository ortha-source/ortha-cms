import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the "ready" screen a created workspace lands on, at
 * `/workspaces/:id/ready` (from `@orthacms/workspaces-admin`): the outcome,
 * the next steps, and the way in.
 */
export class WorkspaceReadyPage extends BasePage {
    /** The "Next steps" section. */
    readonly nextSteps: Locator;
    /** "Back to workspaces". */
    readonly backToWorkspaces: Locator;

    constructor(page: Page) {
        super(page);
        this.nextSteps = page.getByRole('region', { name: 'Next steps' });
        this.backToWorkspaces = page.getByRole('link', {
            name: 'Back to workspaces'
        });
    }

    async goto(id: string) {
        await this.page.goto(`/workspaces/${id}/ready`);
    }

    /** The page `<h1>`, "{name} is ready". */
    heading(name: string): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: `${name} is ready`
        });
    }

    /** The one-line summary under the heading. */
    summary(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** One next step, by its title. */
    step(title: string): Locator {
        return this.nextSteps.getByRole('listitem').filter({ hasText: title });
    }

    /** "Open {name}". */
    openButton(name: string): Locator {
        return this.page.getByRole('link', { name: `Open ${name}` });
    }

    /** The screen for an id the list does not hold. */
    missing(): Locator {
        return this.page
            .getByRole('alert')
            .filter({ hasText: /isn’t in your list/ });
    }
}
