import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { HomePage } from './pages/HomePage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';
import { MembersPage } from './pages/MembersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { ContentLibraryPage } from './pages/ContentLibraryPage';
import { RelationsEditorPage } from './pages/RelationsEditorPage';
import { MediaLibraryPage } from './pages/MediaLibraryPage';
import { MediaFieldPage } from './pages/MediaFieldPage';
import { WysiwygFieldPage } from './pages/WysiwygFieldPage';
import { AgentsPage } from './pages/AgentsPage';
import { CopilotDockPage } from './pages/CopilotDockPage';
import { InsightsPage } from './pages/InsightsPage';

interface Fixtures {
    loginPage: LoginPage;
    acceptInvitePage: AcceptInvitePage;
    homePage: HomePage;
    workspacesPage: WorkspacesPage;
    workspaceSettingsPage: WorkspaceSettingsPage;
    createWorkspacePage: CreateWorkspacePage;
    membersPage: MembersPage;
    userDetailPage: UserDetailPage;
    activityLogPage: ActivityLogPage;
    contentLibraryPage: ContentLibraryPage;
    relationsEditorPage: RelationsEditorPage;
    mediaLibraryPage: MediaLibraryPage;
    mediaFieldPage: MediaFieldPage;
    wysiwygFieldPage: WysiwygFieldPage;
    agentsPage: AgentsPage;
    copilotDockPage: CopilotDockPage;
    insightsPage: InsightsPage;
    /**
     * Factory for a fresh axe scanner scoped to the current page, pre-tagged for
     * WCAG 2.1 A/AA (the team's best-practice target). Call it per assertion so
     * each scan reflects the page's current state.
     */
    makeAxe: () => AxeBuilder;
}

/**
 * `test` extended with page-object + accessibility fixtures — import this (not
 * `@playwright/test`) in specs, so a spec never constructs a page object itself.
 */
export const test = base.extend<Fixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    acceptInvitePage: async ({ page }, use) => {
        await use(new AcceptInvitePage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    },
    workspacesPage: async ({ page }, use) => {
        await use(new WorkspacesPage(page));
    },
    workspaceSettingsPage: async ({ page }, use) => {
        await use(new WorkspaceSettingsPage(page));
    },
    createWorkspacePage: async ({ page }, use) => {
        await use(new CreateWorkspacePage(page));
    },
    membersPage: async ({ page }, use) => {
        await use(new MembersPage(page));
    },
    userDetailPage: async ({ page }, use) => {
        await use(new UserDetailPage(page));
    },
    activityLogPage: async ({ page }, use) => {
        await use(new ActivityLogPage(page));
    },
    contentLibraryPage: async ({ page }, use) => {
        await use(new ContentLibraryPage(page));
    },
    relationsEditorPage: async ({ page }, use) => {
        await use(new RelationsEditorPage(page));
    },
    mediaLibraryPage: async ({ page }, use) => {
        await use(new MediaLibraryPage(page));
    },
    mediaFieldPage: async ({ page }, use) => {
        await use(new MediaFieldPage(page));
    },
    wysiwygFieldPage: async ({ page }, use) => {
        await use(new WysiwygFieldPage(page));
    },
    agentsPage: async ({ page }, use) => {
        await use(new AgentsPage(page));
    },
    copilotDockPage: async ({ page }, use) => {
        await use(new CopilotDockPage(page));
    },
    insightsPage: async ({ page }, use) => {
        await use(new InsightsPage(page));
    },
    makeAxe: async ({ page }, use) => {
        await use(() =>
            new AxeBuilder({ page }).withTags([
                'wcag2a',
                'wcag2aa',
                'wcag21a',
                'wcag21aa'
            ])
        );
    }
});

export { expect } from '@playwright/test';
