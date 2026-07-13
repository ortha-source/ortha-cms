import { SidebarTrigger, useSidebar } from '@ortha-cms/design-system';

/**
 * The floating reveal button for the collapsed sidebar. Fixed to the top-left,
 * it appears only when the sidebar is hidden — collapsed on desktop, or on
 * mobile (where the sidebar is an overlay drawer) — so it never steals layout
 * space. When the sidebar is open on desktop the in-header trigger collapses
 * it, so this button would just overlap the panel and is hidden.
 */
export function SidebarToggle() {
    const { state, isMobile } = useSidebar();

    if (!isMobile && state === 'expanded') {
        return null;
    }

    return (
        <SidebarTrigger className="fixed left-3 top-3 z-30 size-9 rounded-lg border border-border bg-background shadow-sm" />
    );
}
