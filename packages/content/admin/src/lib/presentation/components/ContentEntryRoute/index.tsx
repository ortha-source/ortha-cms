import { Navigate, useParams } from 'react-router-dom';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import type { ContentType } from '../../../domain/types/contentType';
import {
    CONTENT_SEGMENT,
    ENTRY_MODE,
    ENTRY_PARAM,
    TYPE_PARAM
} from '../../../domain/constants';
import { hasOwnAccess } from '../../../domain/contentTypeAccess';
import { ContentEntryView, type EntryMode } from '../ContentEntryView';

/**
 * Route adapter for the create (`:typeName/new`) and edit
 * (`:typeName/:entryId`) entry routes: resolves the `:typeName` param against
 * the workspace's granted types and renders {@link ContentEntryView}. An
 * unknown/ungranted type redirects to the Content Library index (mirroring the
 * page's catch-all), so a deep link can't strand the user on a blank form; a
 * create on a type reached only from shared workspaces redirects to its list.
 */
export function ContentEntryRoute({
    types,
    mode
}: {
    types: ContentType[];
    mode: EntryMode;
}) {
    const params = useParams();
    const workspace = useCurrentWorkspace();
    const type = types.find(
        (candidate) => candidate.name === params[TYPE_PARAM]
    );

    if (!type) {
        return (
            <Navigate
                to={`/workspaces/${workspace.id}/${CONTENT_SEGMENT}`}
                replace
            />
        );
    }

    // A type this workspace reaches only from shared workspaces can't be
    // created here — the server would answer 403 — so the create form is not
    // reachable at all: a deep link to `/new` lands on the type's list, which
    // says where its records come from.
    if (mode === ENTRY_MODE.Create && !hasOwnAccess(type)) {
        return (
            <Navigate
                to={`/workspaces/${workspace.id}/${CONTENT_SEGMENT}/${type.name}`}
                replace
            />
        );
    }

    return (
        <ContentEntryView
            type={type}
            mode={mode}
            entryId={params[ENTRY_PARAM]}
        />
    );
}
