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
import { CopilotSkillsPage } from './pages/CopilotSkillsPage';
import { InsightsPage } from './pages/InsightsPage';
import { ApiTokensPage } from './pages/ApiTokensPage';
import { HostPage } from './pages/HostPage';

/**
 * The tag whitelist every scan runs under.
 *
 * `withTags` is a **whitelist**, not a filter over everything axe knows: a rule
 * carrying none of these tags never executes. The four WCAG tags alone left
 * roughly a third of axe's catalogue switched off — including the entire
 * `best-practice` family, which is where axe files the structural rules
 * (`heading-order`, `page-has-heading-one`, `region`, the `landmark-*` set,
 * `tabindex`, `skip-link`, `aria-dialog-name`). The suite therefore could not
 * see heading structure or landmark structure at all, and said so nowhere: no
 * rule had been *disabled*, so both `AGENTS.md` and the skill could truthfully
 * claim "no rule exclusions" while a third of the catalogue never ran.
 *
 * `best-practice` is now on, which is what makes {@link AXE_KNOWN_GAPS} an
 * honest, reviewable list instead of an invisible hole.
 */
export const AXE_TAGS = [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'best-practice'
] as const;

/**
 * The rules turned back off, and why — the debt that switching `best-practice`
 * on uncovered. Each is a **real** finding with its own ticket, not a rule the
 * project disagrees with; the exclusion exists so the other ~30 newly-enabled
 * rules can guard against regression today rather than waiting on product work
 * in six packages.
 *
 * Measured across the seven `a11y.spec.ts` files (node counts, not test counts):
 *
 * - `region` (49) — content outside any landmark, on every surface. The broadest
 *   of the five and the one that follows from the rest. `ORT-170`
 * - `landmark-one-main` (14) — **all** of them on the unauthenticated routes
 *   (login, accept-invite, the root loader, the auth gate): that shell renders
 *   no `<main>` at all. `ORT-166`
 * - `page-has-heading-one` (11) — the Agents view (6 states, the finding
 *   `ORT-117` was filed for), the login page, the root loader, the Content
 *   Library's welcome + error panes, the Members skeleton. `ORT-167`
 * - `heading-order` (6) — the alert/banner title renders as `<h5>` under an
 *   `<h1>`, so every visible error banner skips three levels. `ORT-168`
 * - `aria-dialog-name` (2) — the Content Library column picker and the create
 *   workspace directory-results popup are `role="dialog"` with no accessible
 *   name; a screen reader announces a bare "dialog". `ORT-169`
 *
 * **Deleting an entry here is the fix's last step**, and `harness/axe-fixture.spec.ts`
 * pins the list so it cannot quietly grow.
 */
export const AXE_KNOWN_GAPS = [
    'region',
    'landmark-one-main',
    'page-has-heading-one',
    'heading-order',
    'aria-dialog-name'
] as const;

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
    copilotSkillsPage: CopilotSkillsPage;
    insightsPage: InsightsPage;
    apiTokensPage: ApiTokensPage;
    hostPage: HostPage;
    /**
     * Factory for a fresh axe scanner scoped to the current page, tagged
     * {@link AXE_TAGS} and with {@link AXE_KNOWN_GAPS} turned back off. Call it
     * per assertion so each scan reflects the page's current state.
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
    copilotSkillsPage: async ({ page }, use) => {
        await use(new CopilotSkillsPage(page));
    },
    insightsPage: async ({ page }, use) => {
        await use(new InsightsPage(page));
    },
    apiTokensPage: async ({ page }, use) => {
        await use(new ApiTokensPage(page));
    },
    hostPage: async ({ page }, use) => {
        await use(new HostPage(page));
    },
    makeAxe: async ({ page }, use) => {
        await use(() =>
            new AxeBuilder({ page })
                .withTags([...AXE_TAGS])
                .disableRules([...AXE_KNOWN_GAPS])
        );
    }
});

export { expect } from '@playwright/test';
