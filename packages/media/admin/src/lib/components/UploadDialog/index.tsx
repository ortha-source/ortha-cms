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
import { UploadCloud, X } from 'lucide-react';
import type { UploadInput } from '../../hooks/useMediaLibrary';
import { formatBytes } from '../../utils/formatBytes';

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
    remove: { id: 'media.upload.remove', defaultMessage: 'Remove file' },
    cancel: { id: 'media.upload.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'media.upload.confirm',
        defaultMessage: 'Upload {count, plural, one {# file} other {# files}}'
    }
});

/**
 * The upload modal — a drag-and-drop zone plus a file picker that stages the
 * chosen files into a removable list before committing. This is a **mockup**: on
 * confirm the parent's `onUpload` synthesises assets from the file metadata (no
 * bytes leave the browser). Staged files reset whenever the dialog reopens.
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
    onUpload: (files: UploadInput[]) => void;
}) {
    const intl = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const [staged, setStaged] = useState<UploadInput[]>([]);
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        if (open) {
            setStaged([]);
            setDragging(false);
        }
    }, [open]);

    const addFiles = (files: FileList | null) => {
        if (!files) return;
        const next = Array.from(files).map((file) => ({
            name: file.name,
            size: file.size,
            type: file.type
        }));
        setStaged((prev) => [...prev, ...next]);
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
                        <ul className="max-h-40 space-y-1 overflow-auto">
                            {staged.map((file, index) => (
                                <li
                                    key={`${file.name}-${index}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm"
                                >
                                    <span className="min-w-0 flex-1 truncate">
                                        {file.name}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {formatBytes(file.size)}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 shrink-0 shadow-none"
                                        aria-label={intl.formatMessage(
                                            messages.remove
                                        )}
                                        onClick={() => removeAt(index)}
                                    >
                                        <X aria-hidden />
                                    </Button>
                                </li>
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
