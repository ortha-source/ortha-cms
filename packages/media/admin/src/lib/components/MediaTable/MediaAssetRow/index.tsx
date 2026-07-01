import { defineMessages, useIntl } from 'react-intl';
import {
    Checkbox,
    TableCell,
    TableRow,
    cn
} from '@ortha-cms/design-system';
import type { MediaAsset } from '../../../types/mediaAsset';
import { formatBytes } from '../../../utils/formatBytes';
import { buildAssetHandlers } from '../../../utils/assetHandlers';
import {
    AssetActionsMenu,
    type AssetActionKind
} from '../../AssetActionsMenu';
import { MediaKindBadge } from '../../MediaKindBadge';
import { MediaThumbnail } from '../../MediaThumbnail';

/** Intl descriptors for {@link MediaAssetRow}, co-located. */
const messages = defineMessages({
    select: { id: 'media.assetRow.select', defaultMessage: 'Select {name}' },
    open: { id: 'media.assetRow.open', defaultMessage: 'Open {name}' },
    dash: { id: 'media.assetRow.dash', defaultMessage: '—' }
});

/**
 * One asset row in the list view — a leading select checkbox, a mini thumbnail +
 * clickable name, the kind badge, size, dimensions, and last-modified date, plus
 * the shared ⋯ menu. Clicking the name opens the detail drawer.
 */
export function MediaAssetRow({
    asset,
    selected,
    onToggleSelect,
    onAction,
    canCreate,
    canUpdate,
    canDelete
}: {
    asset: MediaAsset;
    selected: boolean;
    onToggleSelect: (id: string) => void;
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();
    const handlers = buildAssetHandlers(asset, onAction);

    return (
        <TableRow className={cn(selected && 'bg-muted/50')}>
            <TableCell className="w-10">
                <Checkbox
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(asset.id)}
                    aria-label={intl.formatMessage(messages.select, {
                        name: asset.name
                    })}
                />
            </TableCell>
            <TableCell>
                <div className="flex items-center gap-3">
                    <MediaThumbnail
                        asset={asset}
                        className="size-9 shrink-0 rounded-md"
                        iconClassName="size-4"
                    />
                    <button
                        type="button"
                        onClick={() => onAction('open', asset)}
                        className="min-w-0 truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={intl.formatMessage(messages.open, {
                            name: asset.name
                        })}
                        title={asset.name}
                    >
                        {asset.name}
                    </button>
                </div>
            </TableCell>
            <TableCell>
                <MediaKindBadge kind={asset.kind} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
                {formatBytes(asset.size)}
            </TableCell>
            <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {asset.dimensions
                    ? `${asset.dimensions.width}×${asset.dimensions.height}`
                    : intl.formatMessage(messages.dash)}
            </TableCell>
            <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                {intl.formatDate(asset.updatedAt, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })}
            </TableCell>
            <TableCell className="w-10 text-right">
                <AssetActionsMenu
                    handlers={handlers}
                    canCreate={canCreate}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                />
            </TableCell>
        </TableRow>
    );
}
