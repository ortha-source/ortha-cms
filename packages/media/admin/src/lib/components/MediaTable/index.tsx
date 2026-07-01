import { defineMessages, useIntl } from 'react-intl';
import {
    Checkbox,
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow
} from '@ortha-cms/design-system';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';
import type { AssetActionKind } from '../AssetActionsMenu';
import { MediaAssetRow } from './MediaAssetRow';
import { MediaFolderRow } from './MediaFolderRow';

/** Intl descriptors for {@link MediaTable} column headers, co-located. */
const messages = defineMessages({
    selectAll: { id: 'media.table.selectAll', defaultMessage: 'Select all files' },
    name: { id: 'media.table.name', defaultMessage: 'Name' },
    type: { id: 'media.table.type', defaultMessage: 'Type' },
    size: { id: 'media.table.size', defaultMessage: 'Size' },
    dimensions: { id: 'media.table.dimensions', defaultMessage: 'Dimensions' },
    modified: { id: 'media.table.modified', defaultMessage: 'Modified' },
    actions: { id: 'media.table.actions', defaultMessage: 'Actions' }
});

/**
 * The list view of the open folder — a table with folder rows above asset rows.
 * The header carries a select-all checkbox (toggling every visible asset) and
 * columns that progressively hide on narrower viewports. Purely presentational:
 * selection and actions dispatch up to the page.
 */
export function MediaTable({
    folders,
    assets,
    folderCounts,
    selectedIds,
    allSelected,
    onToggleAll,
    onOpenFolder,
    onRenameFolder,
    onDeleteFolder,
    onToggleSelect,
    onAssetAction,
    canCreate,
    canUpdate,
    canDelete
}: {
    folders: MediaFolder[];
    assets: MediaAsset[];
    folderCounts: Map<string, number>;
    selectedIds: Set<string>;
    allSelected: boolean;
    onToggleAll: () => void;
    onOpenFolder: (folderId: string) => void;
    onRenameFolder: (folder: MediaFolder) => void;
    onDeleteFolder: (folder: MediaFolder) => void;
    onToggleSelect: (id: string) => void;
    onAssetAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();

    return (
        <div className="overflow-hidden rounded-xl border">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40">
                        <TableHead className="w-10">
                            <div className="flex items-center justify-center">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={onToggleAll}
                                    disabled={assets.length === 0}
                                    aria-label={intl.formatMessage(
                                        messages.selectAll
                                    )}
                                />
                            </div>
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.name)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.type)}
                        </TableHead>
                        <TableHead>
                            {intl.formatMessage(messages.size)}
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                            {intl.formatMessage(messages.dimensions)}
                        </TableHead>
                        <TableHead className="hidden lg:table-cell">
                            {intl.formatMessage(messages.modified)}
                        </TableHead>
                        <TableHead className="w-10 text-right">
                            <span className="sr-only">
                                {intl.formatMessage(messages.actions)}
                            </span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {folders.map((folder) => (
                        <MediaFolderRow
                            key={folder.id}
                            folder={folder}
                            assetCount={folderCounts.get(folder.id) ?? 0}
                            onOpen={onOpenFolder}
                            onRename={onRenameFolder}
                            onDelete={onDeleteFolder}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                        />
                    ))}
                    {assets.map((asset) => (
                        <MediaAssetRow
                            key={asset.id}
                            asset={asset}
                            selected={selectedIds.has(asset.id)}
                            onToggleSelect={onToggleSelect}
                            onAction={onAssetAction}
                            canCreate={canCreate}
                            canUpdate={canUpdate}
                            canDelete={canDelete}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
