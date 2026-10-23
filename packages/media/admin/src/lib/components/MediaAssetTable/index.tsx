import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';
import { MEDIA_KIND } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import { buildAssetHandlers } from '../../utils/assetHandlers';
import { fileExtension } from '../../utils/fileExtension';
import { formatBytes } from '../../utils/formatBytes';
import { formatDuration } from '../../utils/formatDuration';
import { AssetActionsMenu, type AssetActionKind } from '../AssetActionsMenu';
import { MediaThumbnail } from '../MediaThumbnail';

/** Intl descriptors for {@link MediaAssetTable}, co-located. */
const messages = defineMessages({
    label: { id: 'media.table.label', defaultMessage: 'Files' },
    selectAll: {
        id: 'media.table.selectAll',
        defaultMessage: 'Select all files on this page'
    },
    select: { id: 'media.table.select', defaultMessage: 'Select {name}' },
    open: { id: 'media.table.open', defaultMessage: 'Open {name}' },
    name: { id: 'media.table.name', defaultMessage: 'Name' },
    type: { id: 'media.table.type', defaultMessage: 'Type' },
    size: { id: 'media.table.size', defaultMessage: 'Size' },
    dimensions: { id: 'media.table.dimensions', defaultMessage: 'Dimensions' },
    uploadedBy: {
        id: 'media.table.uploadedBy',
        defaultMessage: 'Uploaded by'
    },
    date: { id: 'media.table.date', defaultMessage: 'Date' },
    actions: { id: 'media.table.actions', defaultMessage: 'Actions' },
    noAlt: { id: 'media.table.noAlt', defaultMessage: 'No alt text' }
});

/**
 * The list view of the open folder's files — the design-system `Table`, used
 * exactly as every other admin table uses it (no restyled cells), one row per
 * asset: a select checkbox, a small thumbnail beside the name (a button that
 * opens the details panel, named "Open {name}" as the grid tile is), the
 * type, size, dimensions or duration, uploader and date, and the shared ⋯
 * menu. The header checkbox selects or clears every file on the page.
 * Presentational: selection and every action dispatch up to the page.
 */
export function MediaAssetTable({
    assets,
    selectedIds,
    activeId,
    onToggleSelect,
    onToggleAll,
    onAction,
    canCreate,
    canUpdate,
    canDelete
}: {
    assets: MediaAsset[];
    selectedIds: Set<string>;
    /** The asset open in the details panel, marked as the current row. */
    activeId?: string | null;
    onToggleSelect: (id: string) => void;
    /** Select every row on the page, or clear them all when all are selected. */
    onToggleAll: () => void;
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();
    const selectedHere = assets.filter((a) => selectedIds.has(a.id)).length;
    const allChecked =
        selectedHere === 0
            ? false
            : selectedHere === assets.length
              ? true
              : 'indeterminate';

    return (
        <Table aria-label={intl.formatMessage(messages.label)}>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-9">
                        <Checkbox
                            checked={allChecked}
                            onCheckedChange={onToggleAll}
                            aria-label={intl.formatMessage(messages.selectAll)}
                        />
                    </TableHead>
                    <TableHead>{intl.formatMessage(messages.name)}</TableHead>
                    <TableHead>{intl.formatMessage(messages.type)}</TableHead>
                    <TableHead className="text-right">
                        {intl.formatMessage(messages.size)}
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                        {intl.formatMessage(messages.dimensions)}
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                        {intl.formatMessage(messages.uploadedBy)}
                    </TableHead>
                    <TableHead className="hidden sm:table-cell">
                        {intl.formatMessage(messages.date)}
                    </TableHead>
                    <TableHead className="w-10">
                        <span className="sr-only">
                            {intl.formatMessage(messages.actions)}
                        </span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {assets.map((asset) => {
                    const selected = selectedIds.has(asset.id);
                    const missingAlt =
                        asset.kind === MEDIA_KIND.Image && !asset.alt?.trim();
                    return (
                        <TableRow
                            key={asset.id}
                            data-state={selected ? 'selected' : undefined}
                            aria-current={
                                asset.id === activeId ? 'true' : undefined
                            }
                        >
                            <TableCell>
                                <Checkbox
                                    checked={selected}
                                    onCheckedChange={() =>
                                        onToggleSelect(asset.id)
                                    }
                                    aria-label={intl.formatMessage(
                                        messages.select,
                                        { name: asset.name }
                                    )}
                                />
                            </TableCell>
                            <TableCell className="max-w-0 w-full min-w-48">
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <MediaThumbnail
                                        asset={asset}
                                        className="h-6 w-8 shrink-0 rounded"
                                        iconClassName="size-3.5"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onAction('open', asset)}
                                        aria-label={intl.formatMessage(
                                            messages.open,
                                            { name: asset.name }
                                        )}
                                        title={asset.name}
                                        className="min-w-0 truncate text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {asset.name}
                                    </button>
                                    {missingAlt ? (
                                        <Badge
                                            variant="warning"
                                            size="xs"
                                            className="shrink-0"
                                        >
                                            {intl.formatMessage(messages.noAlt)}
                                        </Badge>
                                    ) : null}
                                </span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                {fileExtension(asset.name) ?? asset.mimeType}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                {formatBytes(asset.size)}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                                {asset.dimensions
                                    ? `${asset.dimensions.width}×${asset.dimensions.height}`
                                    : asset.duration
                                      ? formatDuration(asset.duration)
                                      : '—'}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap lg:table-cell">
                                {asset.uploadedBy}
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                                {intl.formatDate(asset.createdAt, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </TableCell>
                            <TableCell className="text-right">
                                <AssetActionsMenu
                                    handlers={buildAssetHandlers(
                                        asset,
                                        onAction
                                    )}
                                    assetName={asset.name}
                                    canCreate={canCreate}
                                    canUpdate={canUpdate}
                                    canDelete={canDelete}
                                />
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
