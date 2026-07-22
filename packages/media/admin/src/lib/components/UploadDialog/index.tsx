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
        defaultMessage: '{count, plural, one {# file ready} other {# files ready}}'
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
 * dialog closes immediately — progress then lives in the page's upload banner,
 * not here, so the user can keep browsing (and queue more) while bytes move.
 * Staged files reset whenever the dialog reopens.
 */
export function UploadDialog({
    open,
    onOpenChange,
    locationLabel,
    onUpload
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Human name of the destination folder (e.g. "All media"). */
    locationLabel: string;
    onUpload: (files: File[]) => void;
}) {
    const intl = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const [staged, setStaged] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (open) {
            setStaged([]);
            setDragging(false);
        }
    }, [open]);

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        setStaged((prev) => [...prev, ...Array.from(files)]);
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
                        {intl.formatMessage(messages.description, {
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
                        {intl.formatMessage(messages.hint)}
                    </p>
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button onClick={submit} disabled={staged.length === 0}>
                        {intl.formatMessage(messages.confirm, {
                            count: staged.length
                        })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
