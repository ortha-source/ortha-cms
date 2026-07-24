import { useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
    ArrowDown,
    ArrowUp,
    FileWarning,
    ImagePlus,
    Trash2,
    Upload
} from 'lucide-react';
import { Badge, Button, cn, Spinner, toast } from '@ortha-cms/design-system';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { MediaRef } from '@ortha-cms/content-admin';
import { ROOT_FOLDER_ID, MEDIA_KIND } from '../../constants';
import { httpMediaGateway } from '../../infrastructure/httpMediaGateway';
import { mediaKeys } from '../../infrastructure/mediaKeys';
import type { MediaAsset } from '../../types/mediaAsset';
import {
    acceptsAsset,
    describeAccept,
    type MediaAccept
} from '../../utils/mediaAccept';
import { MediaKindIcon } from '../MediaKindIcon';
import { MediaPickerDialog } from '../MediaPickerDialog';

const messages = defineMessages({
    select: { id: 'media.field.select', defaultMessage: 'Select from library' },
    add: { id: 'media.field.add', defaultMessage: 'Add from library' },
    upload: { id: 'media.field.upload', defaultMessage: 'Upload' },
    uploading: { id: 'media.field.uploading', defaultMessage: 'Uploading…' },
    remove: { id: 'media.field.remove', defaultMessage: 'Remove {name}' },
    replace: { id: 'media.field.replace', defaultMessage: 'Replace' },
    moveUp: { id: 'media.field.moveUp', defaultMessage: 'Move {name} up' },
    moveDown: { id: 'media.field.moveDown', defaultMessage: 'Move {name} down' },
    emptySingle: {
        id: 'media.field.emptySingle',
        defaultMessage: 'No asset selected.'
    },
    emptyMultiple: {
        id: 'media.field.emptyMultiple',
        defaultMessage: 'No assets attached.'
    },
    accepts: { id: 'media.field.accepts', defaultMessage: 'Accepts: {what}' },
    unavailable: {
        id: 'media.field.unavailable',
        defaultMessage: 'Unavailable asset'
    },
    uploadFailed: {
        id: 'media.field.uploadFailed',
        defaultMessage: 'Upload failed. Please try again.'
    },
    uploadRejected: {
        id: 'media.field.uploadRejected',
        defaultMessage: '{name} is not an accepted file type for this field.'
    }
});

/** The display facts one attached asset needs, from a ref or a picked asset. */
type Display = {
    id: string;
    name: string;
    url: string;
    kind: string;
    mimeType: string;
    missing?: boolean;
};

/** Normalize the field value (single id | id[] | null) to an ordered id list. */
function toIds(value: unknown): string[] {
    if (Array.isArray(value))
        return value.filter((v): v is string => typeof v === 'string' && !!v);
    return typeof value === 'string' && value ? [value] : [];
}

/** A raw-stream url for an id, for a freshly-known asset with no server ref yet. */
function rawUrl(id: string): string {
    return `/api/media/assets/${id}/raw`;
}

/**
 * The editor control for one media field — a single asset or an ordered list.
 * Renders each attached asset as a thumbnail (resolved from the server-provided
 * refs or a just-picked/uploaded asset), and offers **Select from library** (the
 * {@link MediaPickerDialog}) and **Upload** (reuses the media upload endpoint, so
 * the file lands in the library too). Multiple mode adds reorder + per-item
 * remove. Fully controlled: the parent (the Media tab, bound to the entry form)
 * owns the value as an asset id or id array.
 */
export function MediaFieldControl({
    id,
    multiple,
    accept,
    value,
    initialRefs,
    invalid,
    describedBy,
    required,
    onChange,
    onBlur
}: {
    id: string;
    multiple: boolean;
    accept?: MediaAccept;
    value: unknown;
    /** Server-resolved refs for pre-existing ids (names / thumbnails / missing). */
    initialRefs?: MediaRef[];
    invalid?: boolean;
    describedBy?: string;
    required?: boolean;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
}) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const queryClient = useQueryClient();
    const fileInput = useRef<HTMLInputElement>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Locally-known assets (just picked or uploaded), merged over the server refs
    // so a freshly-added asset shows its real name/thumbnail before any refetch.
    const [known, setKnown] = useState<Map<string, MediaAsset>>(new Map());

    const ids = toIds(value);

    const displays = useMemo<Display[]>(() => {
        const refs = new Map(initialRefs?.map((ref) => [ref.id, ref]));
        return ids.map((assetId) => {
            const local = known.get(assetId);
            if (local)
                return {
                    id: assetId,
                    name: local.name,
                    url: local.url,
                    kind: local.kind,
                    mimeType: local.mimeType
                };
            const ref = refs.get(assetId);
            if (ref)
                return {
                    id: assetId,
                    name: ref.name,
                    url: ref.url,
                    kind: ref.kind,
                    mimeType: ref.mimeType,
                    missing: ref.missing
                };
            // No info yet (e.g. reopened before the media read landed) — render a
            // thumbnail by id; the name fills in on the next read.
            return {
                id: assetId,
                name: assetId,
                url: rawUrl(assetId),
                kind: '',
                mimeType: ''
            };
        });
    }, [ids, initialRefs, known]);

    const remember = (assets: MediaAsset[]) => {
        setKnown((current) => {
            const next = new Map(current);
            for (const asset of assets) next.set(asset.id, asset);
            return next;
        });
    };

    const setIds = (nextIds: string[]) => {
        onChange(multiple ? nextIds : (nextIds[0] ?? null));
        onBlur?.();
    };

    const onPicked = (assets: MediaAsset[]) => {
        remember(assets);
        if (multiple) {
            // Append the newly-picked, skipping any already attached.
            const existing = new Set(ids);
            const added = assets
                .map((a) => a.id)
                .filter((assetId) => !existing.has(assetId));
            setIds([...ids, ...added]);
        } else {
            setIds(assets[0] ? [assets[0].id] : []);
        }
    };

    const onUpload = async (files: FileList | null) => {
        const file = files?.[0];
        if (fileInput.current) fileInput.current.value = '';
        if (!file) return;
        setUploading(true);
        try {
            const asset = await httpMediaGateway.uploadFile(
                ROOT_FOLDER_ID,
                file
            );
            // The library should show the new asset immediately.
            queryClient.invalidateQueries({
                queryKey: mediaKeys.all(workspace.id)
            });
            // Guard the field's own restriction — the asset is in the library
            // regardless, but it can't be attached to a field that rejects it.
            if (!acceptsAsset(accept, asset)) {
                toast.error(
                    intl.formatMessage(messages.uploadRejected, {
                        name: asset.name
                    })
                );
                return;
            }
            onPicked([asset]);
        } catch {
            toast.error(intl.formatMessage(messages.uploadFailed));
        } finally {
            setUploading(false);
        }
    };

    const removeAt = (index: number) =>
        setIds(ids.filter((_, i) => i !== index));

    const move = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        const next = [...ids];
        [next[index], next[target]] = [next[target], next[index]];
        setIds(next);
    };

    // Best-effort `accept` on the native file input (server still enforces).
    const acceptAttr = useMemo(() => {
        const mimes = accept?.mimeTypes ?? [];
        const kinds = accept?.kinds ?? [];
        const fromKinds = kinds
            .filter((k) => k === MEDIA_KIND.Image || k === MEDIA_KIND.Video || k === MEDIA_KIND.Audio)
            .map((k) => `${k}/*`);
        const all = [...mimes, ...fromKinds];
        return all.length ? all.join(',') : undefined;
    }, [accept]);

    const acceptHint = describeAccept(accept);

    return (
        <div className="flex flex-col gap-3" aria-describedby={describedBy}>
            {displays.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                    {displays.map((item, index) => (
                        <li
                            key={`${item.id}-${index}`}
                            className={cn(
                                'group relative w-28 overflow-hidden rounded-md border bg-card',
                                item.missing && 'border-destructive/60'
                            )}
                        >
                            <div className="relative aspect-square w-full bg-muted">
                                {item.missing ? (
                                    <span className="flex size-full flex-col items-center justify-center gap-1 text-destructive">
                                        <FileWarning
                                            className="size-6"
                                            aria-hidden
                                        />
                                    </span>
                                ) : item.kind === MEDIA_KIND.Image ||
                                  item.kind === '' ? (
                                    <img
                                        src={item.url}
                                        alt={item.name}
                                        loading="lazy"
                                        className="absolute inset-0 size-full object-cover"
                                    />
                                ) : (
                                    <span className="flex size-full items-center justify-center">
                                        <MediaKindIcon
                                            kind={item.kind as never}
                                            className="size-8 text-muted-foreground"
                                        />
                                    </span>
                                )}
                                {multiple ? (
                                    <span className="absolute left-1 top-1 grid size-5 place-items-center rounded bg-black/55 text-[11px] font-medium text-white tabular-nums">
                                        {index + 1}
                                    </span>
                                ) : null}
                            </div>
                            <p className="truncate px-1.5 py-1 text-xs">
                                {item.missing
                                    ? intl.formatMessage(messages.unavailable)
                                    : item.name}
                            </p>
                            <div className="flex items-center justify-end gap-0.5 border-t px-1 py-0.5">
                                {multiple ? (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-6"
                                            disabled={index === 0}
                                            aria-label={intl.formatMessage(
                                                messages.moveUp,
                                                { name: item.name }
                                            )}
                                            onClick={() => move(index, -1)}
                                        >
                                            <ArrowUp className="size-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-6"
                                            disabled={
                                                index === displays.length - 1
                                            }
                                            aria-label={intl.formatMessage(
                                                messages.moveDown,
                                                { name: item.name }
                                            )}
                                            onClick={() => move(index, 1)}
                                        >
                                            <ArrowDown className="size-3.5" />
                                        </Button>
                                    </>
                                ) : null}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-destructive"
                                    aria-label={intl.formatMessage(
                                        messages.remove,
                                        { name: item.name }
                                    )}
                                    onClick={() => removeAt(index)}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p
                    className={cn(
                        'text-sm text-muted-foreground',
                        invalid && 'text-destructive'
                    )}
                >
                    {intl.formatMessage(
                        multiple
                            ? messages.emptyMultiple
                            : messages.emptySingle
                    )}
                </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    id={id}
                    aria-required={required}
                    aria-invalid={invalid}
                    onClick={() => setPickerOpen(true)}
                >
                    <ImagePlus className="size-4" aria-hidden />
                    {intl.formatMessage(
                        !multiple && displays.length > 0
                            ? messages.replace
                            : multiple
                              ? messages.add
                              : messages.select
                    )}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                >
                    {uploading ? (
                        <Spinner className="size-4" />
                    ) : (
                        <Upload className="size-4" aria-hidden />
                    )}
                    {intl.formatMessage(
                        uploading ? messages.uploading : messages.upload
                    )}
                </Button>
                {acceptHint ? (
                    <Badge variant="outline" className="font-normal">
                        {intl.formatMessage(messages.accepts, {
                            what: acceptHint
                        })}
                    </Badge>
                ) : null}
                <input
                    ref={fileInput}
                    type="file"
                    accept={acceptAttr}
                    className="hidden"
                    onChange={(e) => onUpload(e.target.files)}
                />
            </div>

            <MediaPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                multiple={multiple}
                accept={accept}
                onConfirm={onPicked}
            />
        </div>
    );
}
