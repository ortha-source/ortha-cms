import { createAdmin } from '@ortha-cms/bootstrap-admin';
import { IdentityPlugin } from '@ortha-cms/identity-admin';
import { ShellPlugin } from '@ortha-cms/shell-admin';
import { WorkspacesPlugin } from '@ortha-cms/workspaces-admin';
import './styles.css';

createAdmin({
    plugins: [IdentityPlugin(), ShellPlugin(), WorkspacesPlugin()]
});
