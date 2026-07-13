import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@ortha-cms/design-system';
import { SidebarContentProvider } from '../../utils/sidebarContent';
import { AppSidebar } from '../AppSidebar';
import { SidebarToggle } from './SidebarToggle';

/**
 * The authenticated app shell: a collapsible left {@link AppSidebar} beside a
 * `<main>` inset where the matched private route renders. The host mounts this
 * as the single guarded layout for every non-public route, so it appears only
 * for signed-in users.
 *
 * The sidebar is offcanvas — collapsing slides it away entirely so the content
 * takes the full width; a floating {@link SidebarToggle} (fixed top-left, no
 * layout space) reveals it. `SidebarProvider` owns the open/collapsed state
 * (cookie-persisted, ⌘B toggles); `SidebarContentProvider` lets a descendant
 * route take over the sidebar's contextual region (the workspace shell injects
 * its per-workspace nav there).
 */
export function AppShell() {
    return (
        <SidebarContentProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <Outlet />
                </SidebarInset>
                <SidebarToggle />
            </SidebarProvider>
        </SidebarContentProvider>
    );
}
