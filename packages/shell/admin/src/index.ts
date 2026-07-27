export { ShellPlugin } from './lib/utils/shellPlugin';
export type { ShellAdminPlugin } from './lib/utils/shellPlugin';
export { AppShell } from './lib/components/AppShell';
export { PageTopBar } from './lib/components/PageTopBar';
export type { PageTopBarCrumb } from './lib/components/PageTopBar';
export { SidebarSearch } from './lib/components/AppSidebar/SidebarSearch';
export { HomePage } from './lib/pages/HomePage';
export {
    SIDEBAR_NAV_SLOT,
    SIDEBAR_SECTION_SLOT,
    SIDEBAR_FOOTER_SLOT
} from './lib/slots/sidebarSlots';
export type {
    SidebarItem,
    SidebarGroupId,
    SidebarSectionItem,
    SidebarFooterItem
} from './lib/slots/sidebarSlots';
export {
    useSidebarContent,
    SidebarContentProvider
} from './lib/utils/sidebarContent';

// The two page-fillable chrome regions: the top bar's trailing actions and the
// right panel. A page fills them by portal from inside its own tree, so the
// content keeps the page's context (workspace, slot contexts, form handlers).
export {
    PageActionsPortal,
    RightPanelPortal,
    useRightPanel
} from './lib/utils/pageChrome';
// The bar-side half of the actions region. `PageTopBar` renders it already; a
// page that composes `TopBar` itself adds it as the bar's last child.
export { PageActions } from './lib/components/PageActions';
export { HOME_SECTION_SLOT } from './lib/slots/homeSlots';
export type { HomeSectionItem, HomeRegion } from './lib/slots/homeSlots';
export { COMMAND_SLOT } from './lib/slots/commandSlots';
export type {
    CommandSection,
    CommandSectionProps
} from './lib/slots/commandSlots';
