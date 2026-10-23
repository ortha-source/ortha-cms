import { useJustCreated } from '@orthacms/utils-admin';
import { MEDIA_ASSETS_SCOPE } from '../../hooks/useUploadQueue';
import type { MediaAsset } from '../../types/mediaAsset';
import type { AssetActionKind } from '../AssetActionsMenu';
import { MediaAssetCard } from './MediaAssetCard';

/**
 * The grid view of the open folder's files — a responsive grid of asset
 * tiles. Folders are not tiles here: they live in the folder tree beside the
 * grid (with their own ⋯ menu), so the grid is the folder's files alone.
 *
 * Columns follow the **pane's** width, not the viewport's (a container query),
 * so opening the details panel beside the grid drops a column instead of
 * squeezing every tile. Purely presentational: selection state and every
 * action are dispatched up to the page.
 */
export function MediaGrid({
    assets,
    selectedIds,
    activeId,
    onToggleSelect,
    onAssetAction,
    canCreate,
    canUpdate,
    canDelete
}: {
    assets: MediaAsset[];
    selectedIds: Set<string>;
    /** The asset open in the details panel. */
    activeId?: string | null;
    onToggleSelect: (id: string) => void;
    onAssetAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const isJustUploaded = useJustCreated(MEDIA_ASSETS_SCOPE);

    return (
        <div className="@container">
            <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                {assets.map((asset) => (
                    <MediaAssetCard
                        key={asset.id}
                        asset={asset}
                        selected={selectedIds.has(asset.id)}
                        active={asset.id === activeId}
                        justUploaded={isJustUploaded(asset.id)}
                        onToggleSelect={onToggleSelect}
                        onAction={onAssetAction}
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                    />
                ))}
            </div>
        </div>
    );
}
