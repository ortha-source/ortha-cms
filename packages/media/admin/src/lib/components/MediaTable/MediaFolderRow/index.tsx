import { defineMessages, useIntl } from 'react-intl';
import { Badge, TableCell, TableRow } from '@ortha-cms/design-system';
import { Folder } from 'lucide-react';
import type { MediaFolder } from '../../../types/mediaFolder';
import { FolderActionsMenu } from '../../FolderActionsMenu';

/** Intl descriptors for {@link MediaFolderRow}, co-located. */
const messages = defineMessages({
    open: { id: 'media.folderRow.open', defaultMessage: 'Open folder {name}' },
    folder: { id: 'media.folderRow.folder', defaultMessage: 'Folder' },
    count: {
        id: 'media.folderRow.count',
        defaultMessage: '{count, plural, one {# item} other {# items}}'
    },
    dash: { id: 'media.folderRow.dash', defaultMessage: '—' }
});

/**
 * One folder row in the list view — a folder glyph + clickable name that opens
 * the folder, a "Folder" badge, and its item count, with the shared folder ⋯
 * menu. Folders aren't selectable, so the leading checkbox cell stays empty.
 */
export function MediaFolderRow({
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
        <TableRow
            className="cursor-pointer bg-muted/20"
            onClick={() => onOpen(folder.id)}
        >
            <TableCell className="w-10" />
            <TableCell>
                <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Folder className="size-4" aria-hidden />
                    </span>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpen(folder.id);
                        }}
                        className="min-w-0 truncate text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={intl.formatMessage(messages.open, {
                            name: folder.name
                        })}
                        title={folder.name}
                    >
                        {folder.name}
                    </button>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline" className="gap-1 font-medium">
                    <Folder className="size-3" aria-hidden />
                    {intl.formatMessage(messages.folder)}
                </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.count, { count: assetCount })}
            </TableCell>
            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {intl.formatMessage(messages.dash)}
            </TableCell>
            <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {intl.formatDate(folder.createdAt, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })}
            </TableCell>
            <TableCell
                className="w-10 text-right"
                onClick={(event) => event.stopPropagation()}
            >
                <FolderActionsMenu
                    onOpen={() => onOpen(folder.id)}
                    onRename={() => onRename(folder)}
                    onDelete={() => onDelete(folder)}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                />
            </TableCell>
        </TableRow>
    );
}
