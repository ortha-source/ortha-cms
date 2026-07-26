import { Sidebar, SidebarFooter } from '@ortha-cms/design-system';
import { byOrder } from '@ortha-cms/utils-admin';
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
 *
 * `collapsible="offcanvas"` — collapsing slides the whole panel off-screen (the
 * content nav, collections/pages included, doesn't reduce cleanly to icons), and
 * a reveal button ({@link SidebarToggle}) brings it back. On mobile it renders as
 * an overlay drawer.
 *
 * shadcn's `SidebarRail` is deliberately **not** rendered. It is a 16px-wide
 * invisible strip hanging off the panel's edge that toggles on click — with
 * `offcanvas` it is shifted outside the panel and paints a hairline plus a full
 * `bg-sidebar` block on hover, so it reads as a stray bar in the page with
 * nothing explaining it. It is also `tabIndex={-1}`, so it's a mouse-only
 * affordance for something already covered three ways: the in-header trigger,
 * the `TopBar`'s inline reveal trigger, and ⌘B.
 */
export function AppSidebar() {
    const override = useSidebarContentOverride();
    const footerItems = byOrder(SIDEBAR_FOOTER_SLOT.getItems());

    return (
        <Sidebar collapsible="offcanvas">
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
