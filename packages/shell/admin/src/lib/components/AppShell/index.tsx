import { Outlet } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { SidebarInset, SidebarProvider } from '@ortha-cms/design-system';
import { PageChromeProvider } from '../../utils/pageChrome';
import { SidebarContentProvider } from '../../utils/sidebarContent';
import { AppRightPanel } from '../AppRightPanel';
import { AppSidebar } from '../AppSidebar';
import { SidebarToggle } from './SidebarToggle';

const messages = defineMessages({
    skipToContent: {
        id: 'shell.appShell.skipToContent',
        defaultMessage: 'Skip to main content'
    }
});

/** The id of the `<main>` landmark that the skip link targets. */
const MAIN_CONTENT_ID = 'main-content';

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
 *
 * `PageChromeProvider` owns the other two page-fillable regions: the top bar's
 * trailing **actions** and the **right panel** ({@link AppRightPanel}) — both
 * filled by portal from the page that owns them, so their content keeps that
 * page's context.
 *
 * A "Skip to main content" link is the first focusable element (WCAG 2.4.1
 * Bypass Blocks) — visually hidden until focused, it jumps keyboard users past
 * the sidebar to the `<main id="main-content">` landmark.
 */
export function AppShell() {
    const intl = useIntl();

    return (
        <SidebarContentProvider>
            <PageChromeProvider>
                <SidebarProvider>
                    <a
                        href={`#${MAIN_CONTENT_ID}`}
                        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring"
                    >
                        {intl.formatMessage(messages.skipToContent)}
                    </a>
                    <AppSidebar />
                    <SidebarInset id={MAIN_CONTENT_ID} tabIndex={-1}>
                        <Outlet />
                    </SidebarInset>
                    {/* The third column: empty (zero-width) until a page
                        registers a panel — see `AppRightPanel`. */}
                    <AppRightPanel />
                    <SidebarToggle />
                </SidebarProvider>
            </PageChromeProvider>
        </SidebarContentProvider>
    );
}
