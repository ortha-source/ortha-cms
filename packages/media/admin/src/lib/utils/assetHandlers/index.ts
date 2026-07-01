import type {
    AssetActionHandlers,
    AssetActionKind
} from '../../components/AssetActionsMenu';
import type { MediaAsset } from '../../types/mediaAsset';

/**
 * Adapts a single `(kind, asset)` dispatcher into the discrete
 * {@link AssetActionHandlers} the menu expects. Lets the grid tile, list row,
 * and detail drawer forward every asset action to one page-level handler instead
 * of drilling seven callbacks each.
 */
export function buildAssetHandlers(
    asset: MediaAsset,
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void
): AssetActionHandlers {
    return {
        onOpen: () => onAction('open', asset),
        onDownload: () => onAction('download', asset),
        onCopyLink: () => onAction('copyLink', asset),
        onDuplicate: () => onAction('duplicate', asset),
        onRename: () => onAction('rename', asset),
        onMove: () => onAction('move', asset),
        onDelete: () => onAction('delete', asset)
    };
}
