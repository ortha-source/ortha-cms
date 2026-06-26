import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Container,
    Drawer,
    DrawerContent,
    DrawerTitle
} from '@ortha-cms/design-system';
import { History, PanelLeft, Trash2 } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import { useContentTypes } from '../../api/useContentTypes';
import { useContentFavorites } from '../../hooks/useContentFavorites';
import { ContentSidebar } from '../../components/ContentSidebar';
import { ContentSidebarSkeleton } from '../../components/ContentSidebarSkeleton';
import { ContentSearchDialog } from '../../components/ContentSearchDialog';
import { ContentTypeView } from '../../components/ContentTypeView';
import { ContentWelcome } from '../../components/ContentWelcome';
import { ContentComingSoon } from '../../components/ContentComingSoon';
import { ContentEntryRoute } from '../../components/ContentEntryRoute';
import { ContentLibraryError } from '../../components/ContentLibraryError';
import { ContentLibraryEmpty } from '../../components/ContentLibraryEmpty';
import {
    CONTENT_READ,
    CONTENT_SEGMENT,
    ENTRY_PARAM,
    HISTORY_SEGMENT,
    NEW_SEGMENT,
    SEARCH_SHORTCUT_KEY,
    TRASH_SEGMENT,
    TYPE_PARAM
} from '../../constants';

/** Intl descriptors for the page-level states, co-located here. */
const messages = defineMessages({
    forbiddenTitle: {
        id: 'content.library.forbiddenTitle',
        defaultMessage: 'No access'
    },
    forbiddenBody: {
        id: 'content.library.forbiddenBody',
        defaultMessage: 'You don’t have permission to view content here.'
    },
    historyTitle: {
        id: 'content.history.title',
        defaultMessage: 'History'
    },
    historyBody: {
        id: 'content.history.body',
        defaultMessage: 'A timeline of content changes is coming soon.'
    },
    trashTitle: {
        id: 'content.trash.title',
        defaultMessage: 'Trash'
    },
    trashBody: {
        id: 'content.trash.body',
        defaultMessage: 'Deleted entries will be recoverable here soon.'
    },
    openNav: {
        id: 'content.library.openNav',
        defaultMessage: 'Content menu'
    },
    navTitle: {
        id: 'content.library.navTitle',
        defaultMessage: 'Content navigation'
    }
});

/**
 * The Content Library, mounted inside the workspace shell at
 * `/workspaces/:id/content/*`. It owns a two-pane layout — the {@link
 * ContentSidebar} (collapsible Collections/Pages groups + favorites + a ⌘K
 * search trigger) beside an outlet driven by nested routes (a welcome landing
 * and the selected `:typeName` view). The ⌘K / Ctrl+K palette is owned here so
 * the shortcut works on any sub-route.
 */
export function ContentLibraryPage() {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const canRead = useHasPermission(CONTENT_READ);
    const {
        data: types,
        isPending,
        isError,
        refetch
    } = useContentTypes(canRead);
    const favorites = useContentFavorites(workspace.id);
    const [searchOpen, setSearchOpen] = useState(false);
    // Mobile only: the nav is a left drawer (inline from `md` up). Close it on
    // any navigation so tapping a type takes you straight to its view.
    const [navOpen, setNavOpen] = useState(false);
    const location = useLocation();
    useEffect(() => setNavOpen(false), [location.pathname]);

    const basePath = `/workspaces/${workspace.id}/${CONTENT_SEGMENT}`;

    // ⌘K / Ctrl+K toggles the search palette from anywhere on the page.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key === SEARCH_SHORTCUT_KEY
            ) {
                event.preventDefault();
                setSearchOpen((open) => !open);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    if (!canRead) {
        return (
            <LibraryBoard>
                <ContentPane>
                    <Container className="py-8">
                        <Alert role="alert">
                            <AlertTitle>
                                {intl.formatMessage(messages.forbiddenTitle)}
                            </AlertTitle>
                            <AlertDescription>
                                {intl.formatMessage(messages.forbiddenBody)}
                            </AlertDescription>
                        </Alert>
                    </Container>
                </ContentPane>
            </LibraryBoard>
        );
    }

    if (isError) {
        return (
            <LibraryBoard>
                <ContentPane>
                    <ContentLibraryError onRetry={() => void refetch()} />
                </ContentPane>
            </LibraryBoard>
        );
    }

    if (isPending) {
        return (
            <LibraryBoard>
                <ContentSidebarSkeleton />
                <ContentPane />
            </LibraryBoard>
        );
    }

    // Scope the global content-type catalogue to the slugs this workspace was
    // granted at creation — collections and pages are linked per workspace.
    const granted = new Set(workspace.content);
    const scopedTypes = types.filter((type) => granted.has(type.name));

    if (scopedTypes.length === 0) {
        return (
            <LibraryBoard>
                <ContentPane>
                    <ContentLibraryEmpty />
                </ContentPane>
            </LibraryBoard>
        );
    }

    return (
        <>
            <LibraryBoard>
                {/* Mobile-only: a bar that opens the nav drawer. The inline
                    sidebar hides below `md` so the work area gets full width. */}
                <div className="md:hidden">
                    <Button
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={() => setNavOpen(true)}
                    >
                        <PanelLeft aria-hidden />
                        {intl.formatMessage(messages.openNav)}
                    </Button>
                </div>
                <ContentSidebar
                    className="hidden md:flex"
                    types={scopedTypes}
                    favorites={favorites}
                    basePath={basePath}
                    onOpenSearch={() => setSearchOpen(true)}
                />
                <ContentPane>
                    <Routes>
                        <Route
                            index
                            element={
                                <ContentWelcome
                                    workspaceName={workspace.name}
                                />
                            }
                        />
                        <Route
                            path={HISTORY_SEGMENT}
                            element={
                                <ContentComingSoon
                                    icon={History}
                                    title={intl.formatMessage(
                                        messages.historyTitle
                                    )}
                                    description={intl.formatMessage(
                                        messages.historyBody
                                    )}
                                />
                            }
                        />
                        <Route
                            path={TRASH_SEGMENT}
                            element={
                                <ContentComingSoon
                                    icon={Trash2}
                                    title={intl.formatMessage(
                                        messages.trashTitle
                                    )}
                                    description={intl.formatMessage(
                                        messages.trashBody
                                    )}
                                />
                            }
                        />
                        <Route
                            path={`:${TYPE_PARAM}`}
                            element={<ContentTypeView types={scopedTypes} />}
                        />
                        {/* Create + entry-edit forms. The static `new` segment
                            outranks `:entryId`, so the order is safe. */}
                        <Route
                            path={`:${TYPE_PARAM}/${NEW_SEGMENT}`}
                            element={
                                <ContentEntryRoute
                                    types={scopedTypes}
                                    mode="create"
                                />
                            }
                        />
                        <Route
                            path={`:${TYPE_PARAM}/:${ENTRY_PARAM}`}
                            element={
                                <ContentEntryRoute
                                    types={scopedTypes}
                                    mode="edit"
                                />
                            }
                        />
                        <Route path="*" element={<Navigate to="." replace />} />
                    </Routes>
                </ContentPane>
            </LibraryBoard>

            {/* Mobile nav: the same sidebar in a left drawer. Inert from `md`
                up, where the inline sidebar is shown instead. */}
            <Drawer
                direction="left"
                open={navOpen}
                onOpenChange={setNavOpen}
                shouldScaleBackground={false}
            >
                <DrawerContent className="data-[vaul-drawer-direction=left]:w-[17rem]">
                    <DrawerTitle className="sr-only">
                        {intl.formatMessage(messages.navTitle)}
                    </DrawerTitle>
                    <ContentSidebar
                        className="flex w-full"
                        types={scopedTypes}
                        favorites={favorites}
                        basePath={basePath}
                        onOpenSearch={() => {
                            setNavOpen(false);
                            setSearchOpen(true);
                        }}
                    />
                </DrawerContent>
            </Drawer>

            <ContentSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                types={scopedTypes}
                basePath={basePath}
            />
        </>
    );
}

/**
 * The Content Library canvas — a muted board filling the height under the
 * shell's sticky navbar, holding the flat sidebar region and the work-area
 * island side by side with a gap between them.
 */
function LibraryBoard({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-[calc(100svh-3rem)] flex-col gap-3 bg-muted/40 p-3 md:flex-row">
            {children}
        </div>
    );
}

/**
 * The single work-area island: a rounded, bordered card floating on the canvas,
 * holding the content pane. Scrolls independently of the flat sidebar.
 */
function ContentPane({ children }: { children?: ReactNode }) {
    return (
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border bg-background shadow-sm">
            {children}
        </div>
    );
}
