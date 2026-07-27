import { defineMessages, useIntl } from 'react-intl';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';
import type { AssetActionKind } from '../AssetActionsMenu';
import { MediaFolderCard } from './MediaFolderCard';
import { MediaAssetCard } from './MediaAssetCard';

/** Intl descriptors for {@link MediaGrid} section labels, co-located. */
const messages = defineMessages({
    folders: { id: 'media.grid.folders', defaultMessage: 'Folders' },
    files: { id: 'media.grid.files', defaultMessage: 'Files' }
});

/**
 * The grid view of the open folder — a responsive grid of folder tiles above a
 * responsive grid of asset tiles, each under a small section label (shown only
 * when both kinds are present). Purely presentational: selection state and every
 * action are dispatched up to the page.
 */
export function MediaGrid({
    folders,
    assets,
    folderCounts,
    selectedIds,
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
    const showLabels = folders.length > 0 && assets.length > 0;

    return (
        <div className="space-y-6">
            {folders.length > 0 ? (
                <section>
                    {showLabels ? (
                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {intl.formatMessage(messages.folders)}
                        </h2>
                    ) : null}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {folders.map((folder) => (
                            <MediaFolderCard
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
                    </div>
                </section>
            ) : null}

            {assets.length > 0 ? (
                <section>
                    {showLabels ? (
                        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {intl.formatMessage(messages.files)}
                        </h2>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {assets.map((asset) => (
                            <MediaAssetCard
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
                    </div>
                </section>
            ) : null}
        </div>
    );
}
