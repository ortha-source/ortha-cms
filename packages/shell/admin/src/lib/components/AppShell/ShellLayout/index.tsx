import { Outlet } from 'react-router-dom';
import { SidebarInset, cn, useSidebar } from '@ortha-cms/design-system';
import { AppSidebar } from '../../AppSidebar';
import { CollapsedRail } from '../CollapsedRail';

/**
 * The sidebar-aware body of {@link AppShell}. Reads the sidebar state so it can
 * swap the collapsed chrome: when the sidebar is open on desktop it renders the
 * full `AppSidebar`; otherwise (collapsed, or mobile where the sidebar is an
 * overlay drawer) it shows the thin {@link CollapsedRail} and offsets the inset
 * by its width so nothing floats over the page.
 */
export function ShellLayout() {
    const { state, isMobile } = useSidebar();
    const collapsed = isMobile || state === 'collapsed';

    return (
        <>
            <AppSidebar />
            {collapsed ? <CollapsedRail /> : null}
            <SidebarInset
                className={cn(
                    'transition-[padding] duration-200 ease-linear',
                    collapsed && 'pl-12'
                )}
            >
                <Outlet />
            </SidebarInset>
        </>
    );
}
