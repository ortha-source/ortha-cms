import { SidebarTrigger, useSidebar } from '@ortha-cms/design-system';

/**
 * The floating reveal button for the collapsed sidebar. Fixed to the top-left,
 * it appears only when the sidebar is hidden — collapsed on desktop, or closed
 * on mobile (where the sidebar is an overlay drawer). Clicking it reopens the
 * sidebar; the in-sidebar trigger collapses it again. Sits above page content
 * but below the mobile drawer overlay.
 */
export function SidebarToggle() {
    const { state, isMobile } = useSidebar();

    // When expanded on desktop the in-sidebar trigger handles collapse, so the
    // floating button would just overlap the sidebar — hide it.
    if (!isMobile && state === 'expanded') {
        return null;
    }

    return (
        <SidebarTrigger className="fixed left-3 top-3 z-30 size-9 rounded-lg border border-border bg-background shadow-sm" />
    );
}
