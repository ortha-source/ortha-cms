import { useSyncExternalStore } from 'react';
import type { WysiwygBlock } from '@ortha-cms/wysiwyg-core';

/**
 * The **block clipboard** — what Copy/Cut put aside for Paste above / Paste
 * below.
 *
 * It is deliberately *not* the system clipboard. Reading that back requires a
 * permission prompt the browser may refuse, and it would hand us a string that
 * has to be re-parsed into blocks; holding the blocks themselves means a paste
 * restores the document exactly, attributes and nested children included.
 * Copying still *writes* to the system clipboard as well (see
 * `BlockCommands.copyBlock`) so the content can leave the app — that direction
 * needs no permission.
 *
 * Module-scoped on purpose: copying in one editor and pasting in another (a
 * different field, a different record) is the behavior a writer expects.
 */
let clipboard: readonly WysiwygBlock[] | null = null;

const listeners = new Set<() => void>();

/** Replaces the clipboard contents and notifies every mounted menu. */
export function setBlockClipboard(blocks: readonly WysiwygBlock[]): void {
    clipboard = blocks.length > 0 ? blocks : null;
    for (const listener of listeners) listener();
}

/** The current clipboard contents, or `null` when nothing was copied. */
export function getBlockClipboard(): readonly WysiwygBlock[] | null {
    return clipboard;
}

/** Subscribes to clipboard changes. Returns the unsubscribe function. */
function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * The clipboard as React state, so a block menu shows its Paste actions the
 * moment something is copied — including from another editor on the page.
 */
export function useBlockClipboard(): readonly WysiwygBlock[] | null {
    return useSyncExternalStore(subscribe, getBlockClipboard, () => null);
}
