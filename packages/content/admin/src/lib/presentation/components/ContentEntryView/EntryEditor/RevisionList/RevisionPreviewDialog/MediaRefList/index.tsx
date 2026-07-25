import { defineMessages, useIntl } from 'react-intl';
import type { LucideIcon } from 'lucide-react';
import {
    Archive,
    FileText,
    FileWarning,
    Image,
    Music,
    Video
} from 'lucide-react';
import type { MediaRef } from '../../../../../../../domain/types/contentType';

const messages = defineMessages({
    none: {
        id: 'content.revisions.preview.noAssets',
        defaultMessage: 'No assets'
    },
    unavailable: {
        id: 'content.revisions.preview.assetUnavailable',
        defaultMessage: 'Unavailable asset'
    }
});

/**
 * The glyph standing for a non-image asset kind. A **local** coarse mapping on
 * purpose: content-admin must not import the media plugin (media depends on
 * content, not the reverse), and this only has to pick an icon.
 */
const KIND_ICON: Record<string, LucideIcon> = {
    image: Image,
    video: Video,
    audio: Music,
    document: FileText,
    archive: Archive
};

/**
 * The **exact assets** a media field held in a snapshot — a thumbnail and file
 * name per asset, which is what the preview shows instead of the raw uuid it
 * used to print. An image previews from its own raw-stream url; any other kind
 * gets its kind glyph. An asset the server couldn't resolve (deleted, or in
 * another workspace) is flagged `missing` and reads as "Unavailable asset" — a
 * version can easily outlive the assets it referenced, so that state is normal
 * here rather than exceptional.
 *
 * Order is the stored order: a `multiple` field's list is what the gallery
 * looked like at that version, gaps included.
 */
export function MediaRefList({ refs }: { refs: readonly MediaRef[] }) {
    const intl = useIntl();

    if (!refs.length) {
        return (
            <span className="text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </span>
        );
    }

    return (
        <ul className="flex flex-wrap gap-2">
            {refs.map((ref, index) => {
                const Glyph = ref.missing
                    ? FileWarning
                    : (KIND_ICON[ref.kind] ?? FileText);
                const isImage = !ref.missing && ref.kind === 'image' && ref.url;
                return (
                    <li
                        key={`${ref.id}-${index}`}
                        className="flex min-w-0 max-w-[12rem] items-center gap-2 rounded-md border bg-background px-2 py-1"
                        title={ref.missing ? ref.id : ref.name}
                    >
                        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                            {isImage ? (
                                <img
                                    src={ref.url}
                                    alt=""
                                    loading="lazy"
                                    className="size-full object-cover"
                                />
                            ) : (
                                <Glyph
                                    className={
                                        ref.missing
                                            ? 'size-4 text-destructive'
                                            : 'size-4 text-muted-foreground'
                                    }
                                    aria-hidden
                                />
                            )}
                        </span>
                        <span
                            className={
                                ref.missing
                                    ? 'truncate text-xs italic text-muted-foreground'
                                    : 'truncate text-xs'
                            }
                        >
                            {ref.missing
                                ? intl.formatMessage(messages.unavailable)
                                : ref.name}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
