import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Members page at `/users` (from `@ortha-cms/users-admin`).
 *
 * Data comes from the `GET /api/users` mock (`mockMembers`); tests also need
 * `mockSignedIn` for the auth probe, since the page lives behind the shell's
 * gate. Permission-gated controls assume the signed-in user's `permissions`
 * (set via `mockSignedIn`).
 */
export class MembersPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The search box (leading search icon). */
    readonly search: Locator;
    /** The header's primary "Invite member" button. */
    readonly inviteButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Members',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.search = page.getByRole('searchbox', {
            name: 'Search members by name or email'
        });
        this.inviteButton = page.getByRole('button', {
            name: 'Invite member'
        });
    }

    async goto() {
        await this.page.goto('/users');
    }

    /** A member's row, located by the member's visible name or email text. */
    row(nameOrEmail: string): Locator {
        return this.page.getByRole('row').filter({ hasText: nameOrEmail });
    }

    /** A status pill anywhere in the table (e.g. "Invited"). */
    statusPill(label: string): Locator {
        return this.page.getByText(label, { exact: true });
    }

    /** The kebab actions trigger in a member's row. */
    actionsTrigger(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Open a member's row menu. */
    async openActions(name: string) {
        await this.actionsTrigger(name).click();
    }

    /** A menu item by its label (rendered in the portaled menu). */
    menuItem(label: string): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    /** The read-only role chip in a member's row. */
    roleChip(name: string): Locator {
        return this.row(name).getByText(/^(Admin|Contributor|Viewer)$/);
    }

    // --- invite wizard (/users/invite) ---

    inviteHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'Invite a member',
            level: 1
        });
    }

    inviteEmail(): Locator {
        return this.page.getByLabel('Email');
    }

    continueToRole(): Locator {
        return this.page.getByRole('button', { name: 'Continue to role' });
    }

    continueToWorkspaces(): Locator {
        return this.page.getByRole('button', {
            name: 'Continue to workspaces'
        });
    }

    inviteRole(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    /** A workspace checkbox in the assignment step, by its visible name. */
    inviteWorkspace(name: string): Locator {
        return this.page.getByRole('checkbox', { name });
    }

    sendInvite(): Locator {
        return this.page.getByRole('button', { name: 'Send invite' });
    }

    // --- edit dialog ---

    editDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    editRoleSelect(): Locator {
        return this.editDialog().getByRole('combobox');
    }

    // --- empty / no-access states ---

    noAccessText(): Locator {
        return this.page.getByText('You don’t have access to members');
    }

    emptyText(text: string): Locator {
        return this.page.getByText(text);
    }
}
