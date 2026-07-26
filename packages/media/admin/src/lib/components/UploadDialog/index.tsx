import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    cn
} from '@ortha-cms/design-system';
import { UploadCloud } from 'lucide-react';
import { StagedFileRow } from './StagedFileRow';

/** Stable default for `initialFiles`, so the seeding effect isn't re-run. */
const NO_FILES: File[] = [];

/** Intl descriptors for {@link UploadDialog}, co-located. */
const messages = defineMessages({
    title: { id: 'media.upload.title', defaultMessage: 'Upload assets' },
    description: {
        id: 'media.upload.description',
        defaultMessage: 'Files upload to {location}.'
    },
    dropHere: {
        id: 'media.upload.dropHere',
        defaultMessage: 'Drag & drop files here'
    },
    or: { id: 'media.upload.or', defaultMessage: 'or' },
    browse: { id: 'media.upload.browse', defaultMessage: 'Browse files' },
    hint: {
        id: 'media.upload.hint',
        defaultMessage: 'Images, video, audio, and documents up to 250 MB each.'
    },
    staged: {
        id: 'media.upload.staged',
        defaultMessage:
            '{count, plural, one {# file ready} other {# files ready}}'
    },
    cancel: { id: 'media.upload.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'media.upload.confirm',
        defaultMessage: 'Upload {count, plural, one {# file} other {# files}}'
    }
});

/**
 * The upload modal — a drag-and-drop zone plus a multi-file picker that stages
 * the chosen files into a removable, **previewed** list before committing:
 * images render a real thumbnail off a local object URL (see
 * {@link StagedFileRow}), other kinds a glyph, so a wrong file is caught before
 * a byte moves. Files accumulate across several drops/picks.
 *
 * On confirm the parent's `onUpload` receives the real `File` objects and the
 * dialog closes immediately — progress then lives in the caller's upload banner,
 * not here, so the user can keep browsing (and queue more) while bytes move.
 * Staged files reset whenever the dialog reopens, seeded from `initialFiles`.
 *
 * **Shared by both upload entry points** — the Media Library's toolbar and a
 * content record's media field — so staging, previewing, and the copy are
 * identical in the two places. The field narrows it with `multiple` / `accept` /
 * its own `description` + `hint`; everything else is the same dialog.
 */
export function UploadDialog({
    open,
    onOpenChange,
    locationLabel,
    description,
    hint,
    confirmLabel,
    accept,
    multiple = true,
    initialFiles = NO_FILES,
    onUpload
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Human name of the destination folder (e.g. "All media"). */
    locationLabel: string;
    /** Overrides the default "Files upload to {location}." sentence. */
    description?: string;
    /** Overrides the default size/type hint under the browse button. */
    hint?: string;
    /**
     * Overrides the confirm button's "Upload {n} files". A media field stages the
     * files (they upload with the record), so there the button attaches.
     */
    confirmLabel?: string;
    /** `accept` attribute for the file input (best-effort; the server enforces). */
    accept?: string;
    /** False stages exactly one file — a later pick replaces it. */
    multiple?: boolean;
    /** Files to stage as the dialog opens (e.g. dropped onto a media field). */
    initialFiles?: File[];
    onUpload: (files: File[]) => void;
}) {
    const intl = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const [staged, setStaged] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (open) {
            setStaged(initialFiles);
            setDragging(false);
        }
    }, [open, initialFiles]);

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        const picked = Array.from(files);
        // A single-asset field holds one file: the newest pick replaces the last.
        setStaged((prev) =>
            multiple ? [...prev, ...picked] : picked.slice(0, 1)
        );
    };

    const removeAt = (index: number) => {
        setStaged((prev) => prev.filter((_, i) => i !== index));
    };

    const submit = () => {
        if (staged.length === 0) return;
        onUpload(staged);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {description ??
                            intl.formatMessage(messages.description, {
                                location: locationLabel
                            })}
                    </DialogDescription>
                </DialogHeader>

                <div
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                        event.preventDefault();
                        setDragging(false);
                        addFiles(event.dataTransfer.files);
                    }}
                    className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                        dragging
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-muted/30'
                    )}
                >
                    <UploadCloud
                        className="size-8 text-muted-foreground"
                        aria-hidden
                    />
                    <p className="text-sm font-medium">
                        {intl.formatMessage(messages.dropHere)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.or)}
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="shadow-none"
                        onClick={() => inputRef.current?.click()}
                    >
                        {intl.formatMessage(messages.browse)}
                    </Button>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {hint ?? intl.formatMessage(messages.hint)}
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        className="sr-only"
                        onChange={(event) => {
                            addFiles(event.target.files);
                            event.target.value = '';
                        }}
                    />
                </div>

                {staged.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                            {intl.formatMessage(messages.staged, {
                                count: staged.length
                            })}
                        </p>
                        <ul className="flex max-h-56 flex-col gap-1 overflow-auto">
                            {staged.map((file, index) => (
                                <StagedFileRow
                                    key={`${file.name}-${file.lastModified}-${index}`}
                                    file={file}
                                    onRemove={() => removeAt(index)}
                                />
                            ))}
                        </ul>
                    </div>
                ) : null}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button onClick={submit} disabled={staged.length === 0}>
                        {confirmLabel ??
                            intl.formatMessage(messages.confirm, {
                                count: staged.length
                            })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
