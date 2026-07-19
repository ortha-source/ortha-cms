import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertTitle, AlertDescription, Container } from '@ortha-cms/design-system';
import { useSidebarContent } from '@ortha-cms/shell-admin';
import { useWorkspaces } from '../../../application/useWorkspaces';
import { CurrentWorkspaceProvider } from '../../currentWorkspace';
import { WORKSPACE_ROUTE_SLOT } from '../../slots/workspaceSlots';
import { WorkspaceShellSkeleton } from '../WorkspacesSkeleton';
import { WorkspaceNav } from '../WorkspaceNav';

/** Intl descriptors for the shell's error/empty states, co-located here. */
const messages = defineMessages({
    notFoundTitle: {
        id: 'workspaces.shell.notFoundTitle',
        defaultMessage: 'Workspace not found'
    },
    notFoundBody: {
        id: 'workspaces.shell.notFoundBody',
        defaultMessage:
            'This workspace doesn’t exist or you don’t have access to it.'
    },
    errorTitle: {
        id: 'workspaces.shell.errorTitle',
        defaultMessage: 'Couldn’t load workspaces'
    },
    errorBody: {
        id: 'workspaces.shell.errorBody',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/** Centered alert used for the shell's not-found / load-error states. */
function ShellMessage({ title, body }: { title: string; body: string }) {
    return (
        <Container>
            <Alert className="mt-10" role="alert">
                <AlertTitle>{title}</AlertTitle>
                <AlertDescription>{body}</AlertDescription>
            </Alert>
        </Container>
    );
}

/**
 * The workspace shell — the layout behind `/workspaces/:id/*`. It resolves the
 * `:id` param against the workspaces list, **injects the per-workspace nav into
 * the app sidebar** (via `useSidebarContent`), and renders the content area
 * whose nested `<Routes>` are built from {@link WORKSPACE_ROUTE_SLOT}. Landing
 * on the workspace base redirects to the first section. The resolved workspace
 * is published via {@link CurrentWorkspaceProvider} so inner pages read it
 * without re-fetching.
 *
 * Feature plugins (Content Library, Media Library, Insights) don't mount their
 * own top-level routes — they contribute a route plus a nav entry or section to
 * the slots the sidebar reads, which is what keeps them strictly inside a
 * workspace.
 */
export function WorkspaceShell() {
    const intl = useIntl();
    const { id } = useParams();
    const { data: workspaces, isPending, isError } = useWorkspaces();

    const current = workspaces?.find((workspace) => workspace.id === id);

    // Take over the app sidebar's contextual region with this workspace's nav
    // while the shell is mounted; the shell clears it on unmount. Keyed on the
    // workspace id so switching rebuilds it (the nav reads the rest itself).
    useSidebarContent(
        () => (current ? <WorkspaceNav workspace={current} /> : null),
        [current?.id]
    );

    if (isPending) {
        return <WorkspaceShellSkeleton />;
    }

    if (isError) {
        return (
            <ShellMessage
                title={intl.formatMessage(messages.errorTitle)}
                body={intl.formatMessage(messages.errorBody)}
            />
        );
    }

    if (!current) {
        return (
            <ShellMessage
                title={intl.formatMessage(messages.notFoundTitle)}
                body={intl.formatMessage(messages.notFoundBody)}
            />
        );
    }

    const routes = WORKSPACE_ROUTE_SLOT.getItems();
    // The default section is the lowest-order route (the Content Library) —
    // where the workspace base and any unknown sub-path redirect to. Its base
    // segment is the route path without the trailing `/*`.
    const defaultRoute = routes
        .slice()
        .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))[0];
    const defaultPath = defaultRoute?.path.split('/')[0];

    return (
        <CurrentWorkspaceProvider workspace={current}>
            {/* Fills the main inset beside the app sidebar. A flex column so a
                viewport-bound page (the Content Library) can size itself with
                `flex-1` off THIS element's height instead of measuring the
                viewport again — two independent svh calculations can round a
                pixel apart (visibly at browser zoom ≠ 100%) and hand the
                document a phantom scrollbar beside the pane's own. */}
            <div className="flex min-h-svh flex-col">
                <Routes>
                    {defaultPath ? (
                        <Route
                            index
                            element={<Navigate to={defaultPath} replace />}
                        />
                    ) : null}
                    {routes.map((route) => (
                        <Route
                            key={route.path}
                            path={route.path}
                            element={route.element}
                        />
                    ))}
                    {defaultPath ? (
                        <Route
                            path="*"
                            element={<Navigate to={defaultPath} replace />}
                        />
                    ) : null}
                </Routes>
            </div>
        </CurrentWorkspaceProvider>
    );
}
