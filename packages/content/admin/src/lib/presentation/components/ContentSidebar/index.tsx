import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useMatch } from 'react-router-dom';
import { FileText, Search, Table2 } from 'lucide-react';
import { cn } from '@orthacms/design-system';
import type { ContentType } from '../../../domain/types/contentType';
import type { ContentFavorites } from '../../hooks/useContentFavorites';
import { CONTENT_TYPE_KIND, TYPE_PARAM } from '../../../domain/constants';
import { groupContentTypes } from '../../../domain/groupContentTypes';
import {
    hasOwnAccess,
    sharedSourceGroups
} from '../../../domain/contentTypeAccess';
import { sharedRecordsPath } from '../../../domain/contentEntryPath';
import {
    SEARCH_KEY_SHORTCUTS,
    shortcutModifierGlyph
} from '../../../domain/shortcutModifier';
import { CollapsibleGroup } from './CollapsibleGroup';
import { ContentSidebarItem } from './ContentSidebarItem';

/** Intl descriptors for the content sidebar, co-located here. */
const messages = defineMessages({
    nav: {
        id: 'content.sidebar.nav',
        defaultMessage: 'Content types'
    },
    heading: {
        id: 'content.sidebar.heading',
        defaultMessage: 'Content'
    },
    search: {
        id: 'content.sidebar.search',
        defaultMessage: 'Search…'
    },
    favoritesGroup: {
        id: 'content.sidebar.favoritesGroup',
        defaultMessage: 'Favorites'
    },
    collectionsGroup: {
        id: 'content.sidebar.collectionsGroup',
        defaultMessage: 'Collections'
    },
    pagesGroup: {
        id: 'content.sidebar.pagesGroup',
        defaultMessage: 'Pages'
    },
    workspaceGroup: {
        id: 'content.sidebar.workspaceGroup',
        defaultMessage: 'Workspace Content'
    },
    sharedGroup: {
        id: 'content.sidebar.sharedGroup',
        defaultMessage: 'From {workspace}'
    }
});

type ContentSidebarProps = {
    /**
     * Every content type the workspace reaches, already scoped
     * (`scopeContentTypes`): the own ones list under Workspace Content, and
     * each shared source's under its own "From {workspace}" group.
     */
    types: ContentType[];
    /** Pinned-favorites state for the workspace. */
    favorites: ContentFavorites;
    /** Absolute base path for the library (`/workspaces/:id/content`). */
    basePath: string;
    /** Opens the search command palette. */
    onOpenSearch: () => void;
    /** Extra classes for the root `nav` (e.g. responsive show/hide, width). */
    className?: string;
};

/**
 * The Content Library's second sidebar — a flat nav region on the muted canvas,
 * beside (and outside) the work-area island. A search trigger (opens the ⌘K
 * palette) sits above a non-collapsible Favorites section (only when something
 * is pinned) and the collapsible Collections and Pages sections. Each row links
 * to its type and can be pinned.
 *
 * Below them, one **"From {workspace}"** group per shared workspace the
 * workspace was granted content from, each row opening that source's records
 * of the type, read-only. A type granted both ways shows in both places.
 */
export function ContentSidebar({
    types,
    favorites,
    basePath,
    onOpenSearch,
    className
}: ContentSidebarProps) {
    const intl = useIntl();
    const groupId = useId();
    const modifier = shortcutModifierGlyph();
    // A type reached only from shared workspaces has no own records to list.
    const ownTypes = types.filter(hasOwnAccess);
    const { collections, pages } = groupContentTypes(ownTypes);
    const sharedGroups = sharedSourceGroups(types);

    // Open the group that holds the currently-selected type by default, so
    // deep-linking straight to a collection/page reveals it in the sidebar.
    // Falls back to Collections open when nothing (or a non-type route) is open.
    // Resolved via `useMatch` against `basePath` (not `useParams`) because the
    // sidebar renders in the app shell, above the route that owns the param.
    const typeMatch = useMatch(`${basePath}/:${TYPE_PARAM}/*`);
    const selectedName = typeMatch?.params[TYPE_PARAM];
    const selectedType = ownTypes.find((type) => type.name === selectedName);
    const collectionsOpen = selectedType
        ? selectedType.kind === CONTENT_TYPE_KIND.Collection
        : true;
    const pagesOpen = selectedType?.kind === CONTENT_TYPE_KIND.Single;
    // Favorites in pin order, dropping any names no longer in the catalogue.
    const favoriteTypes = favorites.favorites
        .map((name) => ownTypes.find((type) => type.name === name))
        .filter((type): type is ContentType => Boolean(type));

    const renderItem = (type: ContentType) => (
        <ContentSidebarItem
            key={type.name}
            type={type}
            basePath={basePath}
            pinned={favorites.isPinned(type.name)}
            onTogglePin={favorites.toggle}
        />
    );

    return (
        <nav
            aria-label={intl.formatMessage(messages.nav)}
            className={cn(
                'flex h-full w-60 shrink-0 flex-col overflow-hidden',
                className
            )}
        >
            <div className="flex flex-col gap-2 p-2">
                <h2 className="px-2 text-sm font-semibold tracking-[-0.01em]">
                    {intl.formatMessage(messages.heading)}
                </h2>
                <button
                    type="button"
                    onClick={onOpenSearch}
                    aria-keyshortcuts={SEARCH_KEY_SHORTCUTS}
                    className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                >
                    <Search className="size-4 shrink-0" />
                    <span className="truncate">
                        {intl.formatMessage(messages.search)}
                    </span>
                    {/* The chord is carried by `aria-keyshortcuts` above, so the
                        glyph is decorative: announced literally it reads
                        "place of interest sign K". It also follows the platform
                        rather than hard-coding macOS, since the handler takes
                        Ctrl too and most readers are not on a Mac. */}
                    <kbd
                        aria-hidden
                        className="ml-auto rounded border border-sidebar-border bg-sidebar px-1.5 font-sans text-[10px] text-sidebar-foreground/70"
                    >
                        {modifier}K
                    </kbd>
                </button>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pb-2 pt-2">
                {favoriteTypes.length > 0 ? (
                    <div className="flex w-full min-w-0 flex-col p-2">
                        <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                            {intl.formatMessage(messages.favoritesGroup)}
                        </div>
                        <div className="mt-1 flex w-full min-w-0 flex-col gap-1">
                            {favoriteTypes.map(renderItem)}
                        </div>
                    </div>
                ) : null}

                <div className="flex w-full min-w-0 flex-col p-2">
                    <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                        {intl.formatMessage(messages.workspaceGroup)}
                    </div>
                    <div className="mt-1 flex w-full min-w-0 flex-col gap-1">
                        <CollapsibleGroup
                            label={intl.formatMessage(
                                messages.collectionsGroup
                            )}
                            icon={Table2}
                            count={collections.length}
                            defaultOpen={collectionsOpen}
                        >
                            {collections.map(renderItem)}
                        </CollapsibleGroup>

                        <CollapsibleGroup
                            label={intl.formatMessage(messages.pagesGroup)}
                            icon={FileText}
                            count={pages.length}
                            defaultOpen={pagesOpen}
                        >
                            {pages.map(renderItem)}
                        </CollapsibleGroup>
                    </div>
                </div>

                {sharedGroups.map(({ source, types: sourceTypes }) => {
                    const headingId = `${groupId}-${source.workspaceId}`;
                    return (
                        <div
                            key={source.workspaceId}
                            role="group"
                            aria-labelledby={headingId}
                            className="flex w-full min-w-0 flex-col p-2"
                        >
                            <div
                                id={headingId}
                                className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70"
                            >
                                <span className="truncate">
                                    {intl.formatMessage(messages.sharedGroup, {
                                        workspace: source.workspaceName
                                    })}
                                </span>
                            </div>
                            <div className="mx-3.5 mt-1 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5">
                                {sourceTypes.map((type) => (
                                    <ContentSidebarItem
                                        key={type.name}
                                        type={type}
                                        basePath={basePath}
                                        to={sharedRecordsPath(
                                            basePath,
                                            type.name,
                                            source.workspaceId
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </nav>
    );
}
