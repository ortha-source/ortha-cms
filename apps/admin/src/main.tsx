import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import { ShellPlugin } from '@ortha-cms/shell-admin';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-admin';
import { ContentPlugin } from '@ortha-cms/content-admin';
import { I18nPlugin } from '@ortha-cms/i18n-admin';
import { MediaPlugin } from '@ortha-cms/media-admin';
import { InsightsPlugin } from '@ortha-cms/insights-admin';
import { UsersPlugin } from '@ortha-cms/users-admin';
import { ActivityPlugin } from '@ortha-cms/activity-admin';
import { ApiTokensPlugin } from '@ortha-cms/api-tokens-admin';
import './styles.css';

createAdmin({
    plugins: [
        IdentityPlugin(),
        ShellPlugin(),
        WorkspacesPlugin(),
        // Workspace-interior features — they only contribute to the workspace
        // shell's rail/route slots, so they must follow WorkspacesPlugin().
        ContentPlugin(),
        // Contributes only to the Content Library's extension slots, so it
        // must follow ContentPlugin().
        I18nPlugin(),
        MediaPlugin(),
        InsightsPlugin(),
        UsersPlugin(),
        ActivityPlugin(),
        // Global token-management page in the main sidebar (no workspace
        // context); backs the external content API.
        ApiTokensPlugin()
    ]
});
