import { defineMessages, useIntl } from 'react-intl';
import { Folder } from 'lucide-react';
import { cn } from '@ortha-cms/design-system';
import type { MediaFolder } from '../../../types/mediaFolder';

/** Intl descriptors for {@link MediaFolderTreeItem}, co-located. */
const messages = defineMessages({
    count: {
        id: 'media.tree.count',
        defaultMessage: '{count, plural, one {# item} other {# items}}'
    }
});

/**
 * One folder in the sidebar tree — an indented button that navigates into the
 * folder, highlighted when it's the open one, with its direct children rendered
 * recursively beneath it. Purely presentational; navigation dispatches up.
 */
export function MediaFolderTreeItem({
    folder,
    folders,
    currentFolderId,
    counts,
    depth,
    onNavigate
}: {
    folder: MediaFolder;
    folders: MediaFolder[];
    currentFolderId: string;
    counts: Map<string, number>;
    depth: number;
    onNavigate: (folderId: string) => void;
}) {
    const intl = useIntl();
    const children = folders
        .filter((f) => f.parentId === folder.id)
        .sort((a, b) => a.name.localeCompare(b.name));
    const active = currentFolderId === folder.id;

    return (
        <li>
            <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                aria-current={active ? 'true' : undefined}
                style={{ paddingLeft: `${depth * 14 + 8}px` }}
                className={cn(
                    'flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground hover:bg-accent'
                )}
            >
                <Folder
                    className={cn(
                        'size-4 shrink-0',
                        active ? 'text-primary' : 'text-muted-foreground'
                    )}
                    aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {intl.formatMessage(messages.count, {
                        count: counts.get(folder.id) ?? 0
                    })}
                </span>
            </button>
            {children.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5">
                    {children.map((child) => (
                        <MediaFolderTreeItem
                            key={child.id}
                            folder={child}
                            folders={folders}
                            currentFolderId={currentFolderId}
                            counts={counts}
                            depth={depth + 1}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}
