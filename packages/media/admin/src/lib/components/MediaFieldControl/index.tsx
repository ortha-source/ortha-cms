import { useMemo, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ImagePlus, UploadCloud } from 'lucide-react';
import {
    Button,
    cn,
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    toast
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import type { MediaRef } from '@ortha-cms/content-admin';
import { MEDIA_CREATE, MEDIA_KIND, MEDIA_READ } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFieldDisplay } from '../../types/mediaFieldDisplay';
import type { MediaPendingUploads } from '../../types/pendingUpload';
import { kindFromMime } from '../../utils/kindFromMime';
import {
    acceptsFile,
    describeAccept,
    type MediaAccept
} from '../../utils/mediaAccept';
import { MediaPickerDialog } from '../MediaPickerDialog';
import { UploadDialog } from '../UploadDialog';
import { MediaFieldItem } from './MediaFieldItem';

const messages = defineMessages({
    select: { id: 'media.field.select', defaultMessage: 'Select from library' },
    add: { id: 'media.field.add', defaultMessage: 'Add from library' },
    upload: { id: 'media.field.upload', defaultMessage: 'Upload' },
    replace: { id: 'media.field.replace', defaultMessage: 'Replace' },
    attach: { id: 'media.field.attach', defaultMessage: 'Attach files' },
    uploadTo: {
        id: 'media.field.uploadTo',
        defaultMessage:
            'Files are attached now and uploaded to {location} when you save the record.'
    },
    stagedCount: {
        id: 'media.field.stagedCount',
        defaultMessage:
            '{count, plural, one {# file uploads on save} other {# files upload on save}}'
    },
    uploadHintAccept: {
        id: 'media.field.uploadHintAccept',
        defaultMessage: 'This field accepts {what}. Up to 250 MB each.'
    },
    libraryRoot: { id: 'media.field.libraryRoot', defaultMessage: 'All media' },
    emptySingle: {
        id: 'media.field.emptySingle',
        defaultMessage: 'No asset selected'
    },
    emptyMultiple: {
        id: 'media.field.emptyMultiple',
        defaultMessage: 'No assets attached'
    },
    emptyBody: {
        id: 'media.field.emptyBody',
        defaultMessage:
            'Drop a file here, or pick one from the Media Library. New files upload when you save.'
    },
    emptyBodyPickOnly: {
        id: 'media.field.emptyBodyPickOnly',
        defaultMessage: 'Pick an asset from the Media Library.'
    },
    dropHere: {
        id: 'media.field.dropHere',
        defaultMessage: 'Drop to attach'
    },
    dropBody: {
        id: 'media.field.dropBody',
        defaultMessage:
            'Dropped files open in the upload dialog first, so you can check them.'
    },
    accepts: { id: 'media.field.accepts', defaultMessage: 'Accepts {what}' },
    count: {
        id: 'media.field.count',
        defaultMessage:
            '{count, plural, one {# asset attached} other {# assets attached}}'
    },
    uploadRejected: {
        id: 'media.field.uploadRejected',
        defaultMessage: '{name} is not an accepted file type for this field.'
    },
    noMediaAccess: {
        id: 'media.field.noMediaAccess',
        defaultMessage:
            'You don’t have access to the Media Library, so this field can only be read.'
    }
});

/** Normalize the field value (single id | id[] | null) to an ordered id list. */
function toIds(value: unknown): string[] {
    if (Array.isArray(value))
        return value.filter((v): v is string => typeof v === 'string' && !!v);
    return typeof value === 'string' && value ? [value] : [];
}

/** The original-bytes route for an id we know nothing else about. */
function rawUrl(id: string): string {
    return `/api/media/assets/${id}/raw`;
}

/** Whether a drag carries files (as opposed to text or an in-page element). */
function dragHasFiles(transfer: DataTransfer | null): boolean {
    return !!transfer && Array.from(transfer.types).includes('Files');
}

/**
 * The editor control for one media field — a single asset or an ordered list.
 * The attached assets render as preview tiles ({@link MediaFieldItem}, resolved
 * from the server-provided refs or a just-picked/uploaded asset) inside a panel
 * that doubles as a **drop zone**. Below it sit **Select from library** (the
 * {@link MediaPickerDialog}) and **Upload**, plus the field's accept hint and, in
 * multiple mode, the attached count.
 *
 * **Choosing a file uploads nothing.** The {@link UploadDialog} — the Media
 * Library's own modal, reused whole — stages and previews the files (a drop on
 * the panel opens it pre-staged), and confirming only *stages* them: they get a
 * placeholder id, render as "Pending upload" tiles, and the bytes move when the
 * record is **saved or published** (`usePendingMediaUploads`, the plugin's
 * presave contribution). So abandoning an edit leaves nothing behind in the
 * library, and a record plus its new assets land as one commit.
 *
 * Fully controlled: the parent (the Media tab, bound to the entry form) owns the
 * value as an asset id or id array.
 */
export function MediaFieldControl({
    id,
    multiple,
    accept,
    value,
    initialRefs,
    refsPending,
    invalid,
    describedBy,
    required,
    uploads,
    onChange,
    onBlur
}: {
    id: string;
    multiple: boolean;
    accept?: MediaAccept;
    value: unknown;
    /** Server-resolved refs for pre-existing ids (names / thumbnails / missing). */
    initialRefs?: MediaRef[];
    /**
     * Whether the entry's media read is still in flight. Distinguishes "not
     * resolved **yet**" (wait, render a placeholder) from "resolved to nothing"
     * (the read failed or no media plugin is bound — fall back to the raw route
     * rather than waiting forever).
     */
    refsPending?: boolean;
    invalid?: boolean;
    describedBy?: string;
    required?: boolean;
    /**
     * The editor-level staging for not-yet-uploaded files. Absent when no presave
     * contribution is mounted — the control then offers library picking only,
     * rather than an Upload button that could never commit.
     */
    uploads?: MediaPendingUploads;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
}) {
    const intl = useIntl();
    // Mirror the server's media matrix. Without these the controls still
    // *render*, and the failure lands late and loud: a deferred upload 403s
    // inside the save, which aborts the whole record write — so a missing
    // permission would cost the user their unrelated edits too.
    const canPickMedia = useHasPermission(MEDIA_READ);
    const canUploadMedia = useHasPermission(MEDIA_CREATE);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    // Files dropped on the panel, staged into the upload dialog when it opens —
    // a drop gets the same preview-before-you-commit step as the Upload button.
    const [dropped, setDropped] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    // Nested elements fire dragleave as the pointer crosses them, so the highlight
    // is held by a depth counter rather than the last event to arrive.
    const dragDepth = useRef(0);
    // Locally-known assets (just picked or uploaded), merged over the server refs
    // so a freshly-added asset shows its real name/thumbnail before any refetch.
    const [known, setKnown] = useState<Map<string, MediaAsset>>(new Map());

    const ids = toIds(value);

    // Staging is only offered when the user may actually upload; the presave
    // step would otherwise fail the save on their behalf.
    const canStage = !!uploads && canUploadMedia;
    const pending = uploads?.pending;

    const displays = useMemo<MediaFieldDisplay[]>(() => {
        const refs = new Map(initialRefs?.map((ref) => [ref.id, ref]));
        return ids.map((assetId) => {
            // A staged (not yet uploaded) file: everything is known locally, and
            // an image previews straight off its object URL.
            const staged = pending?.get(assetId);
            if (staged)
                return {
                    id: assetId,
                    name: staged.file.name,
                    url: staged.previewUrl ?? '',
                    kind: kindFromMime(staged.file.type),
                    mimeType: staged.file.type,
                    size: staged.file.size,
                    pending: true
                };
            const local = known.get(assetId);
            if (local)
                return {
                    id: assetId,
                    name: local.name,
                    // Tiles are small: prefer the derivative the server made.
                    url: local.thumbUrl ?? local.previewUrl ?? local.url,
                    originalUrl: local.url,
                    kind: local.kind,
                    mimeType: local.mimeType,
                    size: local.size,
                    dimensions: local.dimensions
                };
            const ref = refs.get(assetId);
            if (ref)
                return {
                    id: assetId,
                    name: ref.name,
                    url: ref.thumbUrl ?? ref.previewUrl ?? ref.url,
                    originalUrl: ref.url,
                    kind: ref.kind,
                    mimeType: ref.mimeType,
                    missing: ref.missing
                };
            // Nothing known about this id. While the entry's media read is in
            // flight, wait: guessing the raw route made every edit-mode open
            // pull **full-size originals** to draw 180px tiles, and printed a
            // uuid where the file name goes. Once the read has settled without
            // a ref (it failed, or no media plugin is bound) waiting would
            // never end — so fall back to the raw route and show *something*.
            // The id names the controls either way, so "Remove …" stays unique.
            if (refsPending)
                return {
                    id: assetId,
                    name: assetId,
                    url: '',
                    kind: '',
                    mimeType: '',
                    resolving: true
                };
            return {
                id: assetId,
                name: assetId,
                url: rawUrl(assetId),
                kind: MEDIA_KIND.Image,
                mimeType: ''
            };
        });
    }, [ids, initialRefs, known, pending, refsPending]);

    const remember = (assets: MediaAsset[]) => {
        setKnown((current) => {
            const next = new Map(current);
            for (const asset of assets) next.set(asset.id, asset);
            return next;
        });
    };

    const setIds = (nextIds: string[]) => {
        // Anything staged that just left the field is forgotten here — one place,
        // so a remove, a replace, and a re-pick all release the preview blob (and
        // stop the save uploading a file nothing references).
        if (pending) {
            const kept = new Set(nextIds);
            for (const assetId of ids) {
                if (!kept.has(assetId) && pending.has(assetId))
                    uploads?.drop(assetId);
            }
        }
        onChange(multiple ? nextIds : (nextIds[0] ?? null));
        onBlur?.();
    };

    const onPicked = (assets: MediaAsset[]) => {
        if (!assets.length) return;
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

    /**
     * Stage the confirmed files against the field — no request yet. Each gets a
     * placeholder id that rides the form until the save uploads it. The field's
     * own `accept` is enforced here on the file's MIME type (the server checks
     * the real asset again on save), so a rejected file never reaches the value.
     */
    const onStaged = (files: File[]) => {
        if (!uploads || !canStage) return;
        const allowed: File[] = [];
        for (const file of files) {
            if (acceptsFile(accept, file)) allowed.push(file);
            else
                toast.error(
                    intl.formatMessage(messages.uploadRejected, {
                        name: file.name
                    })
                );
        }
        if (!allowed.length) return;
        const staged = uploads.stage(multiple ? allowed : allowed.slice(0, 1));
        setIds(multiple ? [...ids, ...staged] : staged.slice(0, 1));
    };

    /** Open the upload dialog, optionally pre-staged with dropped files. */
    const openUploadWith = (files: File[]) => {
        setDropped(multiple ? files : files.slice(0, 1));
        setUploadOpen(true);
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
            .filter(
                (k) =>
                    k === MEDIA_KIND.Image ||
                    k === MEDIA_KIND.Video ||
                    k === MEDIA_KIND.Audio
            )
            .map((k) => `${k}/*`);
        const all = [...mimes, ...fromKinds];
        return all.length ? all.join(',') : undefined;
    }, [accept]);

    const acceptHint = describeAccept(accept);
    const isEmpty = displays.length === 0;
    const stagedCount = displays.filter((item) => item.pending).length;

    return (
        <div className="flex flex-col gap-3">
            <div
                onDragEnter={(event) => {
                    if (!dragHasFiles(event.dataTransfer) || !canStage) return;
                    dragDepth.current += 1;
                    setDragging(true);
                }}
                onDragOver={(event) => {
                    // Without this the browser opens the file instead of dropping.
                    if (dragHasFiles(event.dataTransfer))
                        event.preventDefault();
                }}
                onDragLeave={() => {
                    dragDepth.current = Math.max(0, dragDepth.current - 1);
                    if (dragDepth.current === 0) setDragging(false);
                }}
                onDrop={(event) => {
                    if (!dragHasFiles(event.dataTransfer) || !canStage) return;
                    event.preventDefault();
                    dragDepth.current = 0;
                    setDragging(false);
                    // Straight into the same dialog the Upload button opens, so
                    // a drop is reviewed before it's staged.
                    openUploadWith(Array.from(event.dataTransfer.files));
                }}
                className={cn(
                    'rounded-xl border bg-muted/20 p-3 transition-colors',
                    isEmpty && 'border-dashed',
                    invalid && 'border-destructive/60',
                    dragging && 'border-primary bg-primary/5'
                )}
            >
                {isEmpty ? (
                    <Empty className="gap-4 p-6 md:p-8">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                {dragging ? (
                                    <UploadCloud aria-hidden />
                                ) : (
                                    <ImagePlus aria-hidden />
                                )}
                            </EmptyMedia>
                            <EmptyTitle className="text-base">
                                {dragging
                                    ? intl.formatMessage(messages.dropHere)
                                    : intl.formatMessage(
                                          multiple
                                              ? messages.emptyMultiple
                                              : messages.emptySingle
                                      )}
                            </EmptyTitle>
                            <EmptyDescription>
                                {intl.formatMessage(
                                    dragging
                                        ? messages.dropBody
                                        : canStage
                                          ? messages.emptyBody
                                          : messages.emptyBodyPickOnly
                                )}
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                ) : (
                    <ul
                        className={cn(
                            'grid gap-3',
                            multiple
                                ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4'
                                : 'grid-cols-1 sm:max-w-[15rem]'
                        )}
                    >
                        {displays.map((item, index) => (
                            <MediaFieldItem
                                key={`${item.id}-${index}`}
                                item={item}
                                index={index}
                                total={displays.length}
                                multiple={multiple}
                                onRemove={() => removeAt(index)}
                                onMove={(delta) => move(index, delta)}
                            />
                        ))}
                    </ul>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shadow-none"
                    id={id}
                    aria-required={required}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    disabled={!canPickMedia}
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
                {canStage ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={() => openUploadWith([])}
                    >
                        <UploadCloud className="size-4" aria-hidden />
                        {intl.formatMessage(messages.upload)}
                    </Button>
                ) : null}

                {/* Only when it has something to say — an always-rendered
                    element leaves an empty paragraph in the accessibility tree. */}
                <p
                    className={cn(
                        'ml-auto flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground',
                        !stagedCount &&
                            !acceptHint &&
                            canPickMedia &&
                            !(multiple && displays.length > 0) &&
                            'hidden'
                    )}
                >
                    {stagedCount > 0 ? (
                        <span className="text-foreground">
                            {intl.formatMessage(messages.stagedCount, {
                                count: stagedCount
                            })}
                        </span>
                    ) : null}
                    {multiple && displays.length > 0 ? (
                        <span>
                            {intl.formatMessage(messages.count, {
                                count: displays.length
                            })}
                        </span>
                    ) : null}
                    {acceptHint ? (
                        <span>
                            {intl.formatMessage(messages.accepts, {
                                what: acceptHint
                            })}
                        </span>
                    ) : null}
                    {canPickMedia ? null : (
                        <span>
                            {intl.formatMessage(messages.noMediaAccess)}
                        </span>
                    )}
                </p>
            </div>

            {/* Mounted only while open: the picker carries a whole
                `useMediaLibrary` store (queries + every mutation), and a type
                with three media fields would otherwise idle three of them. */}
            {pickerOpen ? (
                <MediaPickerDialog
                    open
                    onOpenChange={setPickerOpen}
                    multiple={multiple}
                    accept={accept}
                    attachedIds={ids}
                    onConfirm={onPicked}
                />
            ) : null}

            {/* The Media Library's own upload modal — same staging, previews,
                and copy; narrowed to what this field accepts. */}
            <UploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                locationLabel={intl.formatMessage(messages.libraryRoot)}
                description={intl.formatMessage(messages.uploadTo, {
                    location: intl.formatMessage(messages.libraryRoot)
                })}
                hint={
                    acceptHint
                        ? intl.formatMessage(messages.uploadHintAccept, {
                              what: acceptHint
                          })
                        : undefined
                }
                accept={acceptAttr}
                multiple={multiple}
                confirmLabel={intl.formatMessage(messages.attach)}
                initialFiles={dropped}
                onUpload={onStaged}
            />
        </div>
    );
}
