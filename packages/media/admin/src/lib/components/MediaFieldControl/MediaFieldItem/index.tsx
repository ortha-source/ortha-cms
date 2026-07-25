import { defineMessages, useIntl } from 'react-intl';
import {
    ArrowDown,
    ArrowUp,
    ExternalLink,
    FileWarning,
    Trash2
} from 'lucide-react';
import { Button, cn } from '@ortha-cms/design-system';
import { MEDIA_KIND, type MediaKind } from '../../../constants';
import type { MediaFieldDisplay } from '../../../types/mediaFieldDisplay';
import { assetGradient } from '../../../utils/assetGradient';
import { formatBytes } from '../../../utils/formatBytes';
import { MediaKindIcon } from '../../MediaKindIcon';

/** Intl descriptors for {@link MediaFieldItem}, co-located. */
const messages = defineMessages({
    remove: { id: 'media.fieldItem.remove', defaultMessage: 'Remove {name}' },
    preview: {
        id: 'media.fieldItem.preview',
        defaultMessage: 'Open {name} in a new tab'
    },
    moveUp: { id: 'media.fieldItem.moveUp', defaultMessage: 'Move {name} up' },
    moveDown: {
        id: 'media.fieldItem.moveDown',
        defaultMessage: 'Move {name} down'
    },
    unavailable: {
        id: 'media.fieldItem.unavailable',
        defaultMessage: 'Unavailable asset'
    },
    unavailableHint: {
        id: 'media.fieldItem.unavailableHint',
        defaultMessage: 'Deleted or out of workspace'
    },
    pending: {
        id: 'media.fieldItem.pending',
        defaultMessage: 'Uploads on save'
    },
    position: {
        id: 'media.fieldItem.position',
        defaultMessage: 'Position {index} of {total}'
    }
});

/** `image/png` → `PNG`; the short type label under the file name. */
function formatKind(mimeType: string): string | null {
    const subtype = mimeType.split('/')[1];
    if (!subtype) return null;
    return subtype.split('+')[0]?.toUpperCase() ?? null;
}

/** The glyph kind for a ref's `kind` string, falling back for an unknown one. */
function kindOf(kind: string): MediaKind {
    const known = Object.values(MEDIA_KIND) as string[];
    return known.includes(kind) ? (kind as MediaKind) : MEDIA_KIND.Document;
}

/**
 * One attached asset on a media field — a preview tile (the real image, else the
 * asset's deterministic gradient behind its kind glyph) over the file name and
 * what is known of its type / size / dimensions, with the per-item controls
 * revealed on hover or focus: open in a new tab, remove, and — in an ordered
 * multiple field — nudge up/down. A `missing` ref renders as an explicit warning
 * tile instead of a broken preview, so a dead id can still be found and removed.
 */
export function MediaFieldItem({
    item,
    index,
    total,
    multiple,
    onRemove,
    onMove
}: {
    item: MediaFieldDisplay;
    /** Zero-based position, shown (1-based) and used to gate the arrows. */
    index: number;
    total: number;
    /** Ordered-multiple field: renders the position badge + reorder arrows. */
    multiple: boolean;
    onRemove: () => void;
    onMove: (delta: number) => void;
}) {
    const intl = useIntl();
    // An unresolved id (`kind: ''`) is still worth rendering as an image — the
    // raw route serves it, and the kind fills in on the next media read.
    const asImage = item.kind === MEDIA_KIND.Image || item.kind === '';
    const meta = [
        formatKind(item.mimeType),
        typeof item.size === 'number' ? formatBytes(item.size) : null,
        item.dimensions
            ? `${item.dimensions.width}×${item.dimensions.height}`
            : null
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <li
            className={cn(
                'group/item relative overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md',
                item.missing && 'border-destructive/50',
                item.pending && 'border-dashed'
            )}
        >
            <div
                className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
                style={
                    !item.missing && !asImage
                        ? { backgroundImage: assetGradient(item.id) }
                        : undefined
                }
            >
                {item.missing ? (
                    <span className="flex size-full flex-col items-center justify-center gap-1 bg-destructive/5 px-2 text-center text-destructive">
                        <FileWarning className="size-6" aria-hidden />
                        <span className="text-[11px] font-medium leading-tight">
                            {intl.formatMessage(messages.unavailableHint)}
                        </span>
                    </span>
                ) : asImage ? (
                    <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : (
                    <span className="flex size-full items-center justify-center">
                        <MediaKindIcon
                            kind={kindOf(item.kind)}
                            className="size-8 text-white/90 drop-shadow-sm"
                        />
                    </span>
                )}

                {multiple ? (
                    <span
                        className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded bg-black/60 text-[11px] font-medium tabular-nums text-white"
                        title={intl.formatMessage(messages.position, {
                            index: index + 1,
                            total
                        })}
                    >
                        {index + 1}
                    </span>
                ) : null}

                {item.pending ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning-soft-foreground shadow-sm">
                        {intl.formatMessage(messages.pending)}
                    </span>
                ) : null}

                <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-background/85 p-0.5 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover/item:opacity-100 sm:opacity-0">
                    {item.missing || item.pending ? null : (
                        <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="size-6"
                        >
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={intl.formatMessage(
                                    messages.preview,
                                    { name: item.name }
                                )}
                            >
                                <ExternalLink
                                    className="size-3.5"
                                    aria-hidden
                                />
                            </a>
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={intl.formatMessage(messages.remove, {
                            name: item.name
                        })}
                        onClick={onRemove}
                    >
                        <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                </div>

                {multiple && total > 1 ? (
                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-md bg-background/85 p-0.5 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover/item:opacity-100 sm:opacity-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={index === 0}
                            aria-label={intl.formatMessage(messages.moveUp, {
                                name: item.name
                            })}
                            onClick={() => onMove(-1)}
                        >
                            <ArrowUp className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={index === total - 1}
                            aria-label={intl.formatMessage(messages.moveDown, {
                                name: item.name
                            })}
                            onClick={() => onMove(1)}
                        >
                            <ArrowDown className="size-3.5" aria-hidden />
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className="min-w-0 px-2.5 py-2">
                <p
                    className={cn(
                        'truncate text-xs font-medium',
                        item.missing && 'text-destructive'
                    )}
                    title={item.missing ? undefined : item.name}
                >
                    {item.missing
                        ? intl.formatMessage(messages.unavailable)
                        : item.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                    {item.missing ? item.id : meta}
                </p>
            </div>
        </li>
    );
}
