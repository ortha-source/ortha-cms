export { ShellPlugin } from './lib/utils/shellPlugin';
export type { ShellAdminPlugin } from './lib/utils/shellPlugin';
export { AppShell } from './lib/components/AppShell';
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
export { HOME_SECTION_SLOT } from './lib/slots/homeSlots';
export type { HomeSectionItem, HomeRegion } from './lib/slots/homeSlots';
