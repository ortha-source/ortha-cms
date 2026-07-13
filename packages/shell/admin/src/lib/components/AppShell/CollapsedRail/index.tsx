import { SidebarTrigger } from '@ortha-cms/design-system';

/**
 * The thin left rail shown while the sidebar is collapsed (or on mobile, where
 * the sidebar is an overlay drawer). It holds just the reveal trigger at the
 * top — content is offset by its width, so the collapsed state reads as
 * intentional chrome rather than a button floating over the page. Clicking the
 * trigger reopens the sidebar.
 */
export function CollapsedRail() {
    return (
        <div className="fixed inset-y-0 left-0 z-30 flex w-12 flex-col items-center border-r border-sidebar-border bg-sidebar py-2.5">
            <SidebarTrigger className="text-muted-foreground" />
        </div>
    );
}
