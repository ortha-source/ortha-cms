import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertTitle, AlertDescription, Container } from '@ortha-cms/design-system';
import { useWorkspaces } from '../../api/useWorkspaces';
import { CurrentWorkspaceProvider } from '../../utils/currentWorkspace';
import {
    WORKSPACE_SIDEBAR_SLOT,
    WORKSPACE_ROUTE_SLOT
} from '../../slots/workspaceSlots';
import { WorkspaceShellSkeleton } from '../WorkspacesSkeleton';
import { WorkspaceRail } from './WorkspaceRail';

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
 * `:id` param against the workspaces list, then renders the left rail (switcher
 * + section nav) beside a content area whose nested `<Routes>` are built from
 * {@link WORKSPACE_ROUTE_SLOT}. Landing on the workspace base redirects to the
 * first rail section. The resolved workspace is published via
 * {@link CurrentWorkspaceProvider} so inner pages read it without re-fetching.
 *
 * Feature plugins (Content Library, Media Library, Insights) don't mount their
 * own top-level routes — they contribute a rail button + a route to the slots
 * this shell reads, which is what keeps them strictly inside a workspace.
 */
export function WorkspaceShell() {
    const intl = useIntl();
    const { id } = useParams();
    const { data: workspaces, isPending, isError } = useWorkspaces();

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

    const current = workspaces.find((workspace) => workspace.id === id);
    if (!current) {
        return (
            <ShellMessage
                title={intl.formatMessage(messages.notFoundTitle)}
                body={intl.formatMessage(messages.notFoundBody)}
            />
        );
    }

    const routes = WORKSPACE_ROUTE_SLOT.getItems();
    // The default section is the first rail entry by order — where the
    // workspace base and any unknown sub-path redirect to.
    const sorted = WORKSPACE_SIDEBAR_SLOT.getItems()
        .slice()
        .sort((a, b) => a.order - b.order);
    const defaultPath = sorted[0]?.to;

    return (
        <CurrentWorkspaceProvider workspace={current}>
            {/* Fills the height left under the shell's sticky h-12 (3rem) navbar. */}
            <div className="flex min-h-[calc(100svh-3rem)]">
                <WorkspaceRail current={current} workspaces={workspaces} />
                <div className="min-w-0 flex-1">
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
            </div>
        </CurrentWorkspaceProvider>
    );
}
