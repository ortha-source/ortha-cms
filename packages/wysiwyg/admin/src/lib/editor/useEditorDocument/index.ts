import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    isEmptyHtml,
    parseBlocks,
    serializeBlocks,
    type BlockPath,
    type BlockSchema,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import type { CaretPosition } from '../../utils/constants';

/** How a commit should affect the undo history. */
export const HISTORY = {
    /** Push a new undo entry (a structural edit). */
    Push: 'push',
    /** Fold into the previous entry when it is recent (typing). */
    Coalesce: 'coalesce',
    /** Leave the history untouched. */
    Skip: 'skip'
} as const;

/** How a commit should affect the undo history. */
export type HistoryMode = (typeof HISTORY)[keyof typeof HISTORY];

/** A request to move the caret into a block, consumed by that block's view. */
export interface FocusRequest {
    readonly path: BlockPath;
    readonly at: CaretPosition;
    /** Incremented per request so re-focusing the same spot still fires. */
    readonly nonce: number;
}

/** The editor's document state and the operations over it. */
export interface EditorDocument {
    readonly blocks: readonly WysiwygBlock[];
    /** Replaces the block list and (unless told not to) reports the new HTML. */
    commit(next: readonly WysiwygBlock[], history?: HistoryMode): void;
    readonly focusRequest: FocusRequest | null;
    requestFocus(path: BlockPath, at: CaretPosition): void;
    undo(): void;
    redo(): void;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
}

/** Snapshots either side of the present. */
interface HistoryState {
    readonly past: readonly (readonly WysiwygBlock[])[];
    readonly future: readonly (readonly WysiwygBlock[])[];
}

/** How long two typing commits may be apart and still coalesce (ms). */
const COALESCE_WINDOW = 700;

/** How many undo steps to keep. Deep enough to be useful, bounded in memory. */
const HISTORY_LIMIT = 100;

const EMPTY_HISTORY: HistoryState = { past: [], future: [] };

/**
 * Owns the block list, the HTML the field sees, and the undo stack.
 *
 * The **value contract** is the delicate part. The editor is a controlled
 * component whose value is HTML, but re-parsing that HTML on every keystroke
 * would rebuild every block (new ids, new DOM) and take the caret with it. So
 * the last HTML this hook *emitted* is remembered: an incoming `value` equal to
 * it is the echo of our own change and is ignored, while a genuinely different
 * one — a reset, a locale switch, a server round trip — re-parses. That is what
 * makes the editor safe to drive from a form without it fighting the caret.
 */
export function useEditorDocument({
    value,
    onChange,
    schema
}: {
    value: string;
    onChange: (html: string) => void;
    schema: BlockSchema;
}): EditorDocument {
    const options = useMemo(() => ({ schema }), [schema]);
    const [blocks, setBlocks] = useState<readonly WysiwygBlock[]>(() =>
        parseBlocks(value, options)
    );
    const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
    const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

    /** The HTML we last handed to `onChange` — our own echo, to be ignored. */
    const emitted = useRef(value);
    /** The current blocks, readable from a callback without re-creating it. */
    const current = useRef(blocks);
    const lastPushAt = useRef(0);
    const nonce = useRef(0);

    current.current = blocks;

    useEffect(() => {
        if (value === emitted.current) return;
        emitted.current = value;
        const parsed = parseBlocks(value, options);
        current.current = parsed;
        setBlocks(parsed);
        // A value replaced from outside is a different document; keeping the
        // old undo stack would let Ctrl+Z paste the previous record's content
        // into this one.
        setHistory(EMPTY_HISTORY);
    }, [value, options]);

    const emit = useCallback(
        (next: readonly WysiwygBlock[]) => {
            const html = serializeBlocks(next, options);
            // An editor holding nothing must report the empty string, not the
            // `<p></p>` an empty block list serializes to — otherwise every
            // untouched field would look filled in and `required` would pass.
            const nextValue = isEmptyHtml(html) ? '' : html;
            emitted.current = nextValue;
            onChange(nextValue);
        },
        [onChange, options]
    );

    const apply = useCallback(
        (next: readonly WysiwygBlock[]) => {
            current.current = next;
            setBlocks(next);
            emit(next);
        },
        [emit]
    );

    const commit = useCallback(
        (next: readonly WysiwygBlock[], mode: HistoryMode = HISTORY.Push) => {
            if (mode !== HISTORY.Skip) {
                const now = Date.now();
                const previous = current.current;
                const coalesce =
                    mode === HISTORY.Coalesce &&
                    now - lastPushAt.current < COALESCE_WINDOW;
                lastPushAt.current = now;
                if (!coalesce) {
                    setHistory((state) => ({
                        past: [...state.past, previous].slice(-HISTORY_LIMIT),
                        future: []
                    }));
                }
            }
            apply(next);
        },
        [apply]
    );

    const requestFocus = useCallback((path: BlockPath, at: CaretPosition) => {
        nonce.current += 1;
        setFocusRequest({ path, at, nonce: nonce.current });
    }, []);

    const undo = useCallback(() => {
        const previous = history.past[history.past.length - 1];
        if (!previous) return;
        setHistory({
            past: history.past.slice(0, -1),
            future: [...history.future, current.current]
        });
        lastPushAt.current = 0;
        apply(previous);
    }, [history, apply]);

    const redo = useCallback(() => {
        const next = history.future[history.future.length - 1];
        if (!next) return;
        setHistory({
            past: [...history.past, current.current],
            future: history.future.slice(0, -1)
        });
        lastPushAt.current = 0;
        apply(next);
    }, [history, apply]);

    return {
        blocks,
        commit,
        focusRequest,
        requestFocus,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0
    };
}
