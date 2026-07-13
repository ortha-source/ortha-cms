import { Sidebar, SidebarFooter } from '@ortha-cms/design-system';
import { SIDEBAR_FOOTER_SLOT } from '../../slots/sidebarSlots';
import { useSidebarContentOverride } from '../../utils/sidebarContent';
import { GlobalSidebar } from './GlobalSidebar';

/**
 * The single left sidebar that is the admin's app chrome (replacing the old top
 * toolbar). It has three regions:
 *
 * - a **contextual** region (header + nav) that swaps by route: the global nav
 *   by default, or whatever a descendant injects via `useSidebarContent` (the
 *   workspace shell injects its per-workspace nav there); and
 * - a **persistent** footer from {@link SIDEBAR_FOOTER_SLOT} (the account menu),
 *   shown in both the global and per-workspace contexts.
 *
 * Rendered once by {@link AppShell}. The sidebar itself is slot-agnostic beyond
 * the footer: the global region is owned by {@link GlobalSidebar}; the override
 * comes from feature plugins, so new destinations appear without touching this.
 */
export function AppSidebar() {
    const override = useSidebarContentOverride();
    const footerItems = SIDEBAR_FOOTER_SLOT.getItems()
        .slice()
        .sort((a, b) => a.order - b.order);

    return (
        <Sidebar
            collapsible="none"
            className="sticky top-0 h-svh border-r border-sidebar-border"
        >
            {override ?? <GlobalSidebar />}
            {footerItems.length > 0 ? (
                <SidebarFooter className="border-t border-sidebar-border">
                    {footerItems.map(({ id, Component }) => (
                        <Component key={id} />
                    ))}
                </SidebarFooter>
            ) : null}
        </Sidebar>
    );
}
