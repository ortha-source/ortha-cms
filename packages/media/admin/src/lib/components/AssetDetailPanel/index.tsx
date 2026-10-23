import { useEffect, useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Button,
    InputField,
    Separator,
    cn
} from '@orthacms/design-system';
import {
    ChevronLeft,
    ChevronRight,
    Download,
    Link2,
    MoreVertical,
    X
} from 'lucide-react';
import { MEDIA_KIND } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import { formatBytes } from '../../utils/formatBytes';
import { formatDuration } from '../../utils/formatDuration';
import { buildAssetHandlers } from '../../utils/assetHandlers';
import { AssetActionsMenu, type AssetActionKind } from '../AssetActionsMenu';
import { MediaKindBadge } from '../MediaKindBadge';
import { MediaThumbnail } from '../MediaThumbnail';
import { MetaRow } from './MetaRow';

/** Intl descriptors for {@link AssetDetailPanel}, co-located. */
const messages = defineMessages({
    close: { id: 'media.detail.close', defaultMessage: 'Close' },
    previous: { id: 'media.detail.previous', defaultMessage: 'Previous file' },
    next: { id: 'media.detail.next', defaultMessage: 'Next file' },
    download: { id: 'media.detail.download', defaultMessage: 'Download' },
    copyLink: { id: 'media.detail.copyLink', defaultMessage: 'Copy link' },
    more: { id: 'media.detail.more', defaultMessage: 'More actions' },
    details: { id: 'media.detail.details', defaultMessage: 'Details' },
    type: { id: 'media.detail.type', defaultMessage: 'Type' },
    size: { id: 'media.detail.size', defaultMessage: 'Size' },
    dimensions: { id: 'media.detail.dimensions', defaultMessage: 'Dimensions' },
    duration: { id: 'media.detail.duration', defaultMessage: 'Duration' },
    format: { id: 'media.detail.format', defaultMessage: 'Format' },
    location: { id: 'media.detail.location', defaultMessage: 'Folder' },
    uploadedBy: {
        id: 'media.detail.uploadedBy',
        defaultMessage: 'Uploaded by'
    },
    created: { id: 'media.detail.created', defaultMessage: 'Created' },
    modified: { id: 'media.detail.modified', defaultMessage: 'Modified' },
    altText: { id: 'media.detail.altText', defaultMessage: 'Alt text' },
    altMissingBadge: {
        id: 'media.detail.altMissingBadge',
        defaultMessage: 'Missing'
    },
    altPlaceholder: {
        id: 'media.detail.altPlaceholder',
        defaultMessage: 'Describe this image'
    },
    altHint: {
        id: 'media.detail.altHint',
        defaultMessage:
            'Read aloud in place of the image. Leave blank only if it is purely decorative.'
    },
    altSave: { id: 'media.detail.altSave', defaultMessage: 'Save alt text' },
    altMissing: {
        id: 'media.detail.altMissing',
        defaultMessage: 'No alt text yet'
    },
    tags: { id: 'media.detail.tags', defaultMessage: 'Tags' },
    keys: {
        id: 'media.detail.keys',
        defaultMessage: '← → move between files · Esc closes the panel'
    }
});

/**
 * Whether a key press belongs to whatever has focus rather than to the panel:
 * typing in a field, a select or combobox, or anything inside an open menu or
 * dialog (whose own Escape must close *it*, not the panel underneath).
 */
function ownedByFocus(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true;
    return !!target.closest(
        '[role="menu"],[role="dialog"],[role="alertdialog"],[role="listbox"],[role="combobox"]'
    );
}

/**
 * The asset details panel — a **non-modal** column beside the grid, not a
 * drawer over it: the files stay visible and clickable while it is open, and
 * clicking another one simply shows that file here. Under `lg` the page lays
 * it over the browser instead (see the page), still without a focus trap.
 *
 * Its header names the file and carries Previous / Next (also ← / →, when focus
 * isn't in a field or a menu) and Close (also Esc). Below: a large preview, the
 * primary Download / Copy link actions and the shared ⋯ menu, the alt text —
 * **editable here** with `media:update`, the only route to an image's
 * description after upload — then the metadata list and tags.
 *
 * Opening moves focus to the panel (it is a labelled region); closing hands it
 * back to whatever opened it, when that control is still on the page.
 */
export function AssetDetailPanel({
    asset,
    locationLabel,
    onClose,
    onPrevious,
    onNext,
    onAction,
    onSaveAlt,
    canCreate,
    canUpdate,
    canDelete,
    className
}: {
    asset: MediaAsset;
    /** Human name of the folder the asset lives in. */
    locationLabel: string;
    onClose: () => void;
    /** Shows the previous file; omitted on the first one. */
    onPrevious?: () => void;
    /** Shows the next file; omitted on the last one. */
    onNext?: () => void;
    onAction: (kind: AssetActionKind, asset: MediaAsset) => void;
    /** Persists the alt text; resolves whether the server accepted it. */
    onSaveAlt?: (id: string, alt: string) => Promise<boolean>;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    className?: string;
}) {
    const intl = useIntl();
    const titleId = useId();
    const altId = useId();
    const panelRef = useRef<HTMLElement>(null);
    const [alt, setAlt] = useState('');
    const [saving, setSaving] = useState(false);

    // Re-seed whenever a different asset opens, so the field never shows the
    // previous asset's description over this one's.
    const assetAlt = asset.alt ?? '';
    useEffect(() => {
        setAlt(assetAlt);
    }, [asset.id, assetAlt]);

    // Focus in on open, and back out on close. Mount-only on purpose: moving
    // between files keeps the panel mounted and focus where the reader put it.
    useEffect(() => {
        const opener =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        panelRef.current?.focus();
        return () => {
            if (opener?.isConnected) opener.focus();
        };
    }, []);

    // ← / → / Esc from anywhere on the page, unless focus owns the key.
    const keys = useRef({ onPrevious, onNext, onClose });
    keys.current = { onPrevious, onNext, onClose };
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.metaKey) return;
            if (event.ctrlKey || ownedByFocus(event.target)) return;
            const {
                onPrevious: prev,
                onNext: next,
                onClose: close
            } = keys.current;
            if (event.key === 'ArrowLeft' && prev) prev();
            else if (event.key === 'ArrowRight' && next) next();
            else if (event.key === 'Escape') close();
            else return;
            event.preventDefault();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const isImage = asset.kind === MEDIA_KIND.Image;
    const canEditAlt = canUpdate && !!onSaveAlt && isImage;
    const altDirty = alt !== (asset.alt ?? '');
    const missingAlt = isImage && !asset.alt?.trim();

    const saveAlt = () => {
        if (!onSaveAlt) return;
        setSaving(true);
        void onSaveAlt(asset.id, alt).finally(() => setSaving(false));
    };
    const dateOpts = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    } as const;

    const iconButton = 'size-7 shrink-0 shadow-none';

    return (
        <section
            ref={panelRef}
            tabIndex={-1}
            aria-labelledby={titleId}
            className={cn(
                'flex min-h-0 flex-col bg-background focus-visible:outline-none',
                className
            )}
        >
            <div className="flex h-12 shrink-0 items-center gap-1 border-b px-4">
                <h2
                    id={titleId}
                    className="min-w-0 flex-1 truncate text-sm font-semibold"
                    title={asset.name}
                >
                    {asset.name}
                </h2>
                <Button
                    variant="ghost"
                    size="icon"
                    className={iconButton}
                    disabled={!onPrevious}
                    onClick={onPrevious}
                    aria-label={intl.formatMessage(messages.previous)}
                >
                    <ChevronLeft aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={iconButton}
                    disabled={!onNext}
                    onClick={onNext}
                    aria-label={intl.formatMessage(messages.next)}
                >
                    <ChevronRight aria-hidden />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={iconButton}
                    onClick={onClose}
                    aria-label={intl.formatMessage(messages.close)}
                >
                    <X aria-hidden />
                </Button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-auto p-4">
                <MediaThumbnail
                    asset={asset}
                    size="preview"
                    className="aspect-[4/3] w-full rounded-lg border"
                    iconClassName="size-12"
                />

                <div className="flex items-center gap-2">
                    <Button
                        className="flex-1"
                        onClick={() => onAction('download', asset)}
                    >
                        <Download aria-hidden />
                        {intl.formatMessage(messages.download)}
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1 shadow-none"
                        onClick={() => onAction('copyLink', asset)}
                    >
                        <Link2 aria-hidden />
                        {intl.formatMessage(messages.copyLink)}
                    </Button>
                    <AssetActionsMenu
                        handlers={buildAssetHandlers(asset, onAction)}
                        canCreate={canCreate}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        trigger={
                            <Button
                                variant="outline"
                                size="icon"
                                className="shadow-none"
                                aria-label={intl.formatMessage(messages.more)}
                            >
                                <MoreVertical aria-hidden />
                            </Button>
                        }
                    />
                </div>

                {isImage ? (
                    canEditAlt ? (
                        <div className="space-y-2">
                            <InputField
                                id={`asset-alt-${altId}`}
                                label={intl.formatMessage(messages.altText)}
                                labelAction={
                                    missingAlt ? (
                                        <Badge variant="warning" size="xs">
                                            {intl.formatMessage(
                                                messages.altMissingBadge
                                            )}
                                        </Badge>
                                    ) : undefined
                                }
                                description={intl.formatMessage(
                                    messages.altHint
                                )}
                                placeholder={intl.formatMessage(
                                    messages.altPlaceholder
                                )}
                                value={alt}
                                maxLength={1000}
                                onChange={(event) => setAlt(event.target.value)}
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="shadow-none"
                                disabled={!altDirty || saving}
                                onClick={saveAlt}
                            >
                                {intl.formatMessage(messages.altSave)}
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <h3 className="mb-1 text-sm font-medium">
                                {intl.formatMessage(messages.altText)}
                            </h3>
                            <p
                                className={
                                    asset.alt
                                        ? 'text-sm'
                                        : 'text-sm text-muted-foreground'
                                }
                            >
                                {asset.alt ??
                                    intl.formatMessage(messages.altMissing)}
                            </p>
                        </div>
                    )
                ) : null}

                <div>
                    <h3 className="mb-1 text-sm font-medium">
                        {intl.formatMessage(messages.details)}
                    </h3>
                    <dl className="divide-y">
                        <MetaRow label={intl.formatMessage(messages.type)}>
                            <MediaKindBadge kind={asset.kind} />
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.size)}>
                            {formatBytes(asset.size)}
                        </MetaRow>
                        {asset.dimensions ? (
                            <MetaRow
                                label={intl.formatMessage(messages.dimensions)}
                            >
                                {asset.dimensions.width} ×{' '}
                                {asset.dimensions.height}
                            </MetaRow>
                        ) : null}
                        {asset.duration ? (
                            <MetaRow
                                label={intl.formatMessage(messages.duration)}
                            >
                                {formatDuration(asset.duration)}
                            </MetaRow>
                        ) : null}
                        <MetaRow label={intl.formatMessage(messages.format)}>
                            {asset.mimeType}
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.location)}>
                            {locationLabel}
                        </MetaRow>
                        <MetaRow
                            label={intl.formatMessage(messages.uploadedBy)}
                        >
                            {asset.uploadedBy}
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.created)}>
                            {intl.formatDate(asset.createdAt, dateOpts)}
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.modified)}>
                            {intl.formatDate(asset.updatedAt, dateOpts)}
                        </MetaRow>
                    </dl>
                </div>

                {asset.tags.length > 0 ? (
                    <div>
                        <Separator className="mb-3" />
                        <h3 className="mb-2 text-sm font-medium">
                            {intl.formatMessage(messages.tags)}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            {asset.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="font-normal"
                                >
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                ) : null}

                <p className="hidden text-center text-xs text-muted-foreground lg:block">
                    {intl.formatMessage(messages.keys)}
                </p>
            </div>
        </section>
    );
}
