import { Outlet } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from '@ortha-cms/design-system';
import { SidebarContentProvider } from '../../utils/sidebarContent';
import { AppSidebar } from '../AppSidebar';

/**
 * The authenticated app shell: a persistent left {@link AppSidebar} beside a
 * `<main>` inset where the matched private route renders. The host mounts this
 * as the single guarded layout for every non-public route, so it appears only
 * for signed-in users.
 *
 * {@link SidebarContentProvider} lets a descendant route take over the
 * sidebar's contextual region (the workspace shell injects its per-workspace
 * nav there); the global nav shows otherwise.
 */
export function AppShell() {
    return (
        <SidebarContentProvider>
            <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                    <Outlet />
                </SidebarInset>
            </SidebarProvider>
        </SidebarContentProvider>
    );
}
