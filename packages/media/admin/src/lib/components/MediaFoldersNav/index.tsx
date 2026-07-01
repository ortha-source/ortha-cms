import { defineMessages, useIntl } from 'react-intl';
import { Button, cn } from '@ortha-cms/design-system';
import { FolderPlus, HardDrive, Home, Images } from 'lucide-react';
import { ROOT_FOLDER_ID } from '../../constants';
import type { MediaFolder } from '../../types/mediaFolder';
import { formatBytes } from '../../utils/formatBytes';
import { MediaFolderTreeItem } from './MediaFolderTreeItem';

/** Mock storage quota the usage meter fills against (mockup-only). */
const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

/** Intl descriptors for {@link MediaFoldersNav}, co-located. */
const messages = defineMessages({
    heading: { id: 'media.nav.heading', defaultMessage: 'Library' },
    allMedia: { id: 'media.nav.allMedia', defaultMessage: 'All media' },
    allCount: {
        id: 'media.nav.allCount',
        defaultMessage: '{count, plural, one {# item} other {# items}}'
    },
    newFolder: { id: 'media.nav.newFolder', defaultMessage: 'New folder' },
    storage: { id: 'media.nav.storage', defaultMessage: 'Storage' },
    storageUsed: {
        id: 'media.nav.storageUsed',
        defaultMessage: '{used} of {total} used'
    }
});

/**
 * The Media Library's left sidebar — a folder tree headed by an "All media" root
 * entry, a New folder action (permission-gated), and a mock storage-usage meter.
 * Highlights the open folder and dispatches navigation/create up to the page.
 */
export function MediaFoldersNav({
    folders,
    currentFolderId,
    counts,
    rootCount,
    usedBytes,
    onNavigate,
    onNewFolder,
    canCreate,
    className
}: {
    folders: MediaFolder[];
    currentFolderId: string;
    counts: Map<string, number>;
    /** Item count shown against the "All media" root row. */
    rootCount: number;
    /** Total bytes across all assets, for the usage meter. */
    usedBytes: number;
    onNavigate: (folderId: string) => void;
    onNewFolder: () => void;
    canCreate: boolean;
    className?: string;
}) {
    const intl = useIntl();
    const topLevel = folders
        .filter((f) => f.parentId === ROOT_FOLDER_ID)
        .sort((a, b) => a.name.localeCompare(b.name));
    const rootActive = currentFolderId === ROOT_FOLDER_ID;
    const usedPct = Math.min(
        100,
        Math.round((usedBytes / STORAGE_QUOTA_BYTES) * 100)
    );

    return (
        <aside
            className={cn(
                'flex w-64 shrink-0 flex-col gap-3 rounded-xl border bg-background p-3 shadow-sm',
                className
            )}
        >
            <div className="flex items-center gap-2 px-1">
                <Images className="size-4 text-muted-foreground" aria-hidden />
                <h2 className="text-sm font-semibold">
                    {intl.formatMessage(messages.heading)}
                </h2>
            </div>

            <nav className="min-h-0 flex-1 overflow-auto">
                <ul className="space-y-0.5">
                    <li>
                        <button
                            type="button"
                            onClick={() => onNavigate(ROOT_FOLDER_ID)}
                            aria-current={rootActive ? 'true' : undefined}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                rootActive
                                    ? 'bg-primary/10 font-medium text-primary'
                                    : 'text-foreground hover:bg-accent'
                            )}
                        >
                            <Home
                                className={cn(
                                    'size-4 shrink-0',
                                    rootActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground'
                                )}
                                aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate">
                                {intl.formatMessage(messages.allMedia)}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {intl.formatMessage(messages.allCount, {
                                    count: rootCount
                                })}
                            </span>
                        </button>
                    </li>
                    {topLevel.map((folder) => (
                        <MediaFolderTreeItem
                            key={folder.id}
                            folder={folder}
                            folders={folders}
                            currentFolderId={currentFolderId}
                            counts={counts}
                            depth={1}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            </nav>

            {canCreate ? (
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start shadow-none"
                    onClick={onNewFolder}
                >
                    <FolderPlus aria-hidden />
                    {intl.formatMessage(messages.newFolder)}
                </Button>
            ) : null}

            <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <HardDrive className="size-3.5" aria-hidden />
                    {intl.formatMessage(messages.storage)}
                </div>
                <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={usedPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${usedPct}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.storageUsed, {
                        used: formatBytes(usedBytes),
                        total: formatBytes(STORAGE_QUOTA_BYTES)
                    })}
                </p>
            </div>
        </aside>
    );
}
