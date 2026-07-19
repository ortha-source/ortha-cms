import { useEffect, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useWorkspaces } from '@ortha-cms/workspaces-admin';
import { useContentTypes } from '../../../application/useContentTypes';
import { useContentFavorites } from '../../hooks/useContentFavorites';
import { ContentSidebar } from '../ContentSidebar';
import { ContentSearchDialog } from '../ContentSearchDialog';
import { CONTENT_READ, CONTENT_SEGMENT, SEARCH_SHORTCUT_KEY } from '../../../domain/constants';

/**
 * The Content Library's "Content" section of the workspace sidebar — the
 * content-type nav (Collections/Pages groups + favorites) and the ⌘K search
 * palette, contributed to the workspace shell's `WORKSPACE_SECTION_SLOT` so it
 * renders in the app sidebar (formerly the library page's own second sidebar).
 *
 * It renders **outside** the workspace shell's `CurrentWorkspaceProvider`, so
 * it resolves the open workspace itself — from the route (`useMatch`) against
 * the workspaces list — rather than `useCurrentWorkspace()`. Renders nothing
 * until a workspace with granted content types is resolved, or when the user
 * lacks `content:read`, so it never shows an empty section. Owns the ⌘K /
 * Ctrl+K shortcut so search works anywhere inside the workspace.
 */
export function ContentNavSection() {
    const match = useMatch('/workspaces/:id/*');
    const workspaceId = match?.params.id;
    const canRead = useHasPermission(CONTENT_READ);
    const { data: workspaces } = useWorkspaces();
    const { data: types, isPending } = useContentTypes(
        canRead && Boolean(workspaceId)
    );
    const favorites = useContentFavorites(workspaceId ?? '');
    const [searchOpen, setSearchOpen] = useState(false);

    // ⌘K / Ctrl+K toggles the search palette from anywhere inside the workspace.
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

    const workspace = workspaces?.find((item) => item.id === workspaceId);
    // Render nothing until a workspace with granted content types resolves —
    // the section is supplementary, so it simply appears once ready (the types
    // query is fast and shared with the library page's cache).
    if (!workspaceId || !canRead || !workspace || isPending) {
        return null;
    }

    // Scope the global content-type catalogue to the workspace's granted slugs.
    const granted = new Set(workspace.content);
    const scopedTypes = (types ?? []).filter((type) => granted.has(type.name));
    if (scopedTypes.length === 0) {
        return null;
    }

    const basePath = `/workspaces/${workspaceId}/${CONTENT_SEGMENT}`;

    return (
        <>
            <ContentSidebar
                className="h-auto w-full overflow-visible"
                types={scopedTypes}
                favorites={favorites}
                basePath={basePath}
                onOpenSearch={() => setSearchOpen(true)}
            />
            <ContentSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                types={scopedTypes}
                basePath={basePath}
            />
        </>
    );
}
