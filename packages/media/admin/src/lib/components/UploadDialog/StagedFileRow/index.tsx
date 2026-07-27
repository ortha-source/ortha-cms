import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@ortha-cms/design-system';
import { FileText, Film, Music, Package, X } from 'lucide-react';
import { formatBytes } from '../../../utils/formatBytes';

/** Intl descriptors for {@link StagedFileRow}, co-located. */
const messages = defineMessages({
    remove: { id: 'media.upload.removeFile', defaultMessage: 'Remove {name}' }
});

/**
 * The glyph shown for a non-image file, chosen from its MIME type. Deliberately
 * a **local** coarse mapping and not a shared `kindFromMime`: the server owns
 * the real classification (it's what ends up on the row), and this only has to
 * pick an icon for a file that hasn't been uploaded yet.
 */
function glyphFor(type: string) {
    if (type.startsWith('video/')) return Film;
    if (type.startsWith('audio/')) return Music;
    if (
        type === 'application/zip' ||
        type === 'application/x-tar' ||
        type === 'application/gzip'
    ) {
        return Package;
    }
    return FileText;
}

/**
 * One staged (not yet uploaded) file in the upload dialog: a real thumbnail for
 * an image, a kind glyph for anything else, the name + size, and a remove
 * button.
 *
 * The thumbnail is an **object URL** over the local `File` — no upload, no
 * network. It is revoked when the row unmounts or the file changes; skipping
 * that leaks the whole blob for the tab's lifetime, which matters when someone
 * stages a few hundred megabytes of video and then removes it.
 */
export function StagedFileRow({
    file,
    onRemove
}: {
    file: File;
    onRemove: () => void;
}) {
    const intl = useIntl();
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isImage = file.type.startsWith('image/');

    useEffect(() => {
        if (!isImage) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isImage]);

    const Glyph = glyphFor(file.type);

    return (
        <li className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt=""
                        className="size-full object-cover"
                    />
                ) : (
                    <Glyph
                        className="size-4 text-muted-foreground"
                        aria-hidden
                    />
                )}
            </span>

            <span className="min-w-0 flex-1 truncate">{file.name}</span>

            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatBytes(file.size)}
            </span>

            <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 shadow-none"
                aria-label={intl.formatMessage(messages.remove, {
                    name: file.name
                })}
                onClick={onRemove}
            >
                <X aria-hidden />
            </Button>
        </li>
    );
}
