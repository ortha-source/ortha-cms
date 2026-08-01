import { useCallback, useMemo, useRef, useState } from 'react';
import type { AssetPicker, WysiwygMediaAsset } from '@ortha-cms/content-admin';
import { MediaPickerDialog } from '../../components/MediaPickerDialog';
import { MEDIA_KIND } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';

/** Stable id of this contribution, so the slot registration reads once. */
export const WYSIWYG_ASSET_PICKER_ID = 'media.assetPicker';

/** Images only — the rich-text image block has nowhere to put a PDF. */
const IMAGES_ONLY = { kinds: [MEDIA_KIND.Image] };

/**
 * The Media Library, offered to content-admin's rich-text field as an
 * {@link AssetPicker} — how an image block in a `wysiwyg` field gets a URL from
 * the library instead of only from a pasted link.
 *
 * The editor's port is a **promise**, and the library's picker is a **dialog**,
 * so this adapts one to the other: `pick()` opens the dialog and parks the
 * resolver until the author confirms or dismisses. Everything a dialog needs to
 * exist — the open flag, the mounted element — stays here; the editor sees one
 * async function and knows nothing about React trees.
 *
 * The picked asset's URL is stored **as the image's `src`**, not as an asset id.
 * That is the whole contract of the field: its value is HTML any consumer can
 * render, with nothing to resolve. It also means an asset deleted from the
 * library leaves a dead image in a document — worth stating plainly, because the
 * alternative (an id the delivery layer resolves) would make the stored value
 * unusable without this CMS.
 */
export function useWysiwygAssetPicker(): AssetPicker {
    const [open, setOpen] = useState(false);
    /** The `pick()` promise waiting on the dialog, if one is. */
    const pending = useRef<((asset: WysiwygMediaAsset | null) => void) | null>(
        null
    );

    /** Answers the waiting `pick()` — at most once, whichever way it ends. */
    const settle = useCallback((asset: WysiwygMediaAsset | null) => {
        const resolve = pending.current;
        pending.current = null;
        resolve?.(asset);
    }, []);

    const port = useMemo(
        () => ({
            pick: () =>
                new Promise<WysiwygMediaAsset | null>((resolve) => {
                    // A second `pick()` while one is open would strand the
                    // first for ever; answer it with a dismissal instead.
                    settle(null);
                    pending.current = resolve;
                    setOpen(true);
                })
        }),
        [settle]
    );

    const overlay = (
        <MediaPickerDialog
            open={open}
            multiple={false}
            accept={IMAGES_ONLY}
            onOpenChange={(next) => {
                setOpen(next);
                // Closing without confirming is a dismissal. Confirm resolves
                // first and clears `pending`, so this can't overwrite it.
                if (!next) settle(null);
            }}
            onConfirm={(assets) => settle(toMediaAsset(assets[0]))}
        />
    );

    return { port, overlay };
}

/** A library asset as the editor's port describes one. */
function toMediaAsset(asset: MediaAsset | undefined): WysiwygMediaAsset | null {
    if (!asset) return null;
    return { url: asset.url, alt: asset.alt, name: asset.name };
}
