import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Container
} from '@ortha-cms/design-system';
import { History, Trash2 } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import { useContentTypes } from '../../api/useContentTypes';
import { ContentTypeView } from '../../components/ContentTypeView';
import { ContentWelcome } from '../../components/ContentWelcome';
import { ContentComingSoon } from '../../components/ContentComingSoon';
import { ContentEntryRoute } from '../../components/ContentEntryRoute';
import { ContentLibraryError } from '../../components/ContentLibraryError';
import { ContentLibraryEmpty } from '../../components/ContentLibraryEmpty';
import {
    CONTENT_READ,
    ENTRY_MODE,
    ENTRY_PARAM,
    HISTORY_SEGMENT,
    NEW_SEGMENT,
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
    }
});

/**
 * The Content Library work area, mounted inside the workspace shell at
 * `/workspaces/:id/content/*`. The content-type nav and the ⌘K search palette
 * now live in the app sidebar (the Content section, `ContentNavSection`); this
 * page owns only the work-area island — an outlet driven by nested routes (a
 * welcome landing and the selected `:typeName` view / entry editor).
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

    if (!canRead) {
        return (
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
        );
    }

    if (isError) {
        return (
            <ContentPane>
                <ContentLibraryError onRetry={() => void refetch()} />
            </ContentPane>
        );
    }

    if (isPending) {
        return <ContentPane />;
    }

    // Scope the global content-type catalogue to the slugs this workspace was
    // granted at creation — collections and pages are linked per workspace.
    const granted = new Set(workspace.content);
    const scopedTypes = types.filter((type) => granted.has(type.name));

    if (scopedTypes.length === 0) {
        return (
            <ContentPane>
                <ContentLibraryEmpty />
            </ContentPane>
        );
    }

    return (
        <ContentPane>
            <Routes>
                <Route
                    index
                    element={<ContentWelcome workspaceName={workspace.name} />}
                />
                <Route
                    path={HISTORY_SEGMENT}
                    element={
                        <ContentComingSoon
                            icon={History}
                            title={intl.formatMessage(messages.historyTitle)}
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
                            title={intl.formatMessage(messages.trashTitle)}
                            description={intl.formatMessage(messages.trashBody)}
                        />
                    }
                />
                <Route
                    path={`:${TYPE_PARAM}`}
                    element={<ContentTypeView types={scopedTypes} />}
                />
                {/* A collection's trash view. The static `trash` segment
                    outranks `:entryId`, so the order is safe. */}
                <Route
                    path={`:${TYPE_PARAM}/${TRASH_SEGMENT}`}
                    element={<ContentTypeView types={scopedTypes} trashed />}
                />
                {/* Create + entry-edit forms. The static `new` segment outranks
                    `:entryId`, so the order is safe. */}
                <Route
                    path={`:${TYPE_PARAM}/${NEW_SEGMENT}`}
                    element={
                        <ContentEntryRoute
                            types={scopedTypes}
                            mode={ENTRY_MODE.Create}
                        />
                    }
                />
                <Route
                    path={`:${TYPE_PARAM}/:${ENTRY_PARAM}`}
                    element={
                        <ContentEntryRoute
                            types={scopedTypes}
                            mode={ENTRY_MODE.Edit}
                        />
                    }
                />
                <Route path="*" element={<Navigate to="." replace />} />
            </Routes>
        </ContentPane>
    );
}

/**
 * The Content Library work area: fills the viewport height beside the app
 * sidebar and scrolls its content independently. Flush to the canvas (no muted
 * board or bordered island) — the records table and the entry editor render
 * directly on the background and bring their own gutters.
 */
function ContentPane({ children }: { children?: ReactNode }) {
    return <div className="h-svh min-w-0 overflow-auto">{children}</div>;
}
