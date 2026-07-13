import { SidebarProvider } from '@ortha-cms/design-system';
import { SidebarContentProvider } from '../../utils/sidebarContent';
import { ShellLayout } from './ShellLayout';

/**
 * The authenticated app shell: a collapsible left {@link AppSidebar} beside a
 * `<main>` inset where the matched private route renders. The host mounts this
 * as the single guarded layout for every non-public route, so it appears only
 * for signed-in users.
 *
 * `SidebarProvider` owns the open/collapsed state (persisted to a cookie, ⌘B to
 * toggle); `SidebarContentProvider` lets a descendant route take over the
 * sidebar's contextual region (the workspace shell injects its per-workspace
 * nav there). The sidebar-aware body lives in {@link ShellLayout}.
 */
export function AppShell() {
    return (
        <SidebarContentProvider>
            <SidebarProvider>
                <ShellLayout />
            </SidebarProvider>
        </SidebarContentProvider>
    );
}
