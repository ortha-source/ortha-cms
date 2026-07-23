import { defineMessages, useIntl } from 'react-intl';
import { Folder } from 'lucide-react';
import type { MediaFolder } from '../../../types/mediaFolder';
import { FolderActionsMenu } from '../../FolderActionsMenu';

/** Intl descriptors for {@link MediaFolderCard}, co-located. */
const messages = defineMessages({
    open: { id: 'media.folderCard.open', defaultMessage: 'Open folder {name}' },
    count: {
        id: 'media.folderCard.count',
        defaultMessage: '{count, plural, one {# item} other {# items}}'
    }
});

/**
 * A folder tile in the grid — a folder glyph, name, and item count, with a hover
 * ⋯ menu (Open / Rename / Delete). The tile body is a single button that opens
 * the folder; the menu sits outside it so the two controls don't nest.
 */
export function MediaFolderCard({
    folder,
    assetCount,
    onOpen,
    onRename,
    onDelete,
    canUpdate,
    canDelete
}: {
    folder: MediaFolder;
    assetCount: number;
    onOpen: (folderId: string) => void;
    onRename: (folder: MediaFolder) => void;
    onDelete: (folder: MediaFolder) => void;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();

    return (
        <div className="group relative rounded-xl border bg-card transition-colors hover:border-primary/40 hover:bg-accent/40">
            <button
                type="button"
                onClick={() => onOpen(folder.id)}
                onDoubleClick={() => onOpen(folder.id)}
                aria-label={intl.formatMessage(messages.open, {
                    name: folder.name
                })}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Folder className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                        {folder.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                        {intl.formatMessage(messages.count, {
                            count: assetCount
                        })}
                    </span>
                </span>
            </button>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <FolderActionsMenu
                    onOpen={() => onOpen(folder.id)}
                    onRename={() => onRename(folder)}
                    onDelete={() => onDelete(folder)}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                />
            </div>
        </div>
    );
}
