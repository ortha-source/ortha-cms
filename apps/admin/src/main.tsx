import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import { ShellPlugin } from '@ortha-cms/shell-admin';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-admin';
import { ContentPlugin } from '@ortha-cms/content-admin';
import { MediaPlugin } from '@ortha-cms/media-admin';
import { InsightsPlugin } from '@ortha-cms/insights-admin';
import { UsersPlugin } from '@ortha-cms/users-admin';
import { ActivityPlugin } from '@ortha-cms/activity-admin';
import './styles.css';

createAdmin({
    plugins: [
        IdentityPlugin(),
        ShellPlugin(),
        WorkspacesPlugin(),
        // Workspace-interior features — they only contribute to the workspace
        // shell's rail/route slots, so they must follow WorkspacesPlugin().
        ContentPlugin(),
        MediaPlugin(),
        InsightsPlugin(),
        UsersPlugin(),
        ActivityPlugin()
    ]
});
