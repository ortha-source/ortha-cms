import type {
    AssetActionHandlers,
    AssetActionKind
} from '../../components/AssetActionsMenu';
import type { MediaAsset } from '../../types/mediaAsset';

/**
 * Adapts a single `(kind, asset)` dispatcher into the discrete
 * {@link AssetActionHandlers} the menu expects. Lets the grid tile and the
 * detail drawer forward every asset action to one page-level handler instead of
 * drilling six callbacks each. `'open'` is not among them — it isn't a menu
 * item; the tile's thumbnail and filename dispatch it directly.
 */
export function buildAssetHandlers(
    asset: MediaAsset,
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void
): AssetActionHandlers {
    return {
        onDownload: () => onAction('download', asset),
        onCopyLink: () => onAction('copyLink', asset),
        onDuplicate: () => onAction('duplicate', asset),
        onRename: () => onAction('rename', asset),
        onMove: () => onAction('move', asset),
        onDelete: () => onAction('delete', asset)
    };
}
