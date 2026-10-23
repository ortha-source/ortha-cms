import { defineMessages, useIntl } from 'react-intl';
import { Badge, Checkbox, cn } from '@orthacms/design-system';
import { MEDIA_KIND } from '../../../constants';
import type { MediaAsset } from '../../../types/mediaAsset';
import { formatBytes } from '../../../utils/formatBytes';
import { buildAssetHandlers } from '../../../utils/assetHandlers';
import { fileExtension } from '../../../utils/fileExtension';
import { AssetActionsMenu, type AssetActionKind } from '../../AssetActionsMenu';
import { MediaThumbnail } from '../../MediaThumbnail';

/** Intl descriptors for {@link MediaAssetCard}, co-located. */
const messages = defineMessages({
    open: { id: 'media.assetCard.open', defaultMessage: 'Open {name}' },
    select: { id: 'media.assetCard.select', defaultMessage: 'Select {name}' },
    noAlt: { id: 'media.assetCard.noAlt', defaultMessage: 'No alt text' }
});

/**
 * An asset tile in the grid — a 4:3 thumbnail with a hover ⋯ menu and a
 * selection checkbox (always visible once selected), over the name and a
 * dimensions · size line. A file with no picture shows its
 * extension ("PDF", "MP4") under the kind glyph, and an image with no alt text
 * says so on the tile, since that is the gap a library is usually swept for.
 * Clicking the thumbnail or name opens the details panel; the checkbox toggles
 * selection. A selected tile, and the one open in the panel, get a ring.
 */
export function MediaAssetCard({
    asset,
    selected,
    active = false,
    onToggleSelect,
    onAction,
    canCreate,
    canUpdate,
    canDelete,
    justUploaded = false
}: {
    asset: MediaAsset;
    selected: boolean;
    /** The tile's file is the one open in the details panel. */
    active?: boolean;
    /**
     * The asset was just uploaded: the tile rises into its slot. Not
     * `ds-flash` — its keyframes animate `background-color` to transparent,
     * which would drop the tile's card background for the length of the fade.
     */
    justUploaded?: boolean;
    onToggleSelect: (id: string) => void;
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();
    const handlers = buildAssetHandlers(asset, onAction);
    const isImage = asset.kind === MEDIA_KIND.Image;
    const extension = isImage ? null : fileExtension(asset.name);
    const missingAlt = isImage && !asset.alt?.trim();
    const meta = [
        // A clip's duration is already on its thumbnail.
        asset.dimensions
            ? `${asset.dimensions.width}×${asset.dimensions.height}`
            : null,
        formatBytes(asset.size)
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <div
            aria-current={active ? 'true' : undefined}
            className={cn(
                'group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md',
                (selected || active) && 'ring-2 ring-primary ring-offset-1',
                justUploaded && 'ds-item-enter'
            )}
        >
            <div className="relative">
                <button
                    type="button"
                    onClick={() => onAction('open', asset)}
                    aria-label={intl.formatMessage(messages.open, {
                        name: asset.name
                    })}
                    className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <MediaThumbnail
                        asset={asset}
                        className="aspect-[4/3] w-full"
                        label={extension}
                    />
                </button>

                <div
                    className={cn(
                        'absolute left-2 top-2 rounded-md bg-background/80 p-0.5 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100',
                        selected ? 'opacity-100' : 'opacity-0'
                    )}
                >
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelect(asset.id)}
                        aria-label={intl.formatMessage(messages.select, {
                            name: asset.name
                        })}
                    />
                </div>

                <div className="absolute right-2 top-2 rounded-md bg-background/80 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
                    <AssetActionsMenu
                        handlers={handlers}
                        assetName={asset.name}
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                    />
                </div>

                {missingAlt ? (
                    <Badge
                        variant="warning"
                        size="xs"
                        className="pointer-events-none absolute bottom-2 left-2 shadow-sm"
                    >
                        {intl.formatMessage(messages.noAlt)}
                    </Badge>
                ) : null}
            </div>

            <div className="px-3 py-2.5">
                <button
                    type="button"
                    onClick={() => onAction('open', asset)}
                    className="block w-full truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={asset.name}
                >
                    {asset.name}
                </button>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {meta}
                </p>
            </div>
        </div>
    );
}
