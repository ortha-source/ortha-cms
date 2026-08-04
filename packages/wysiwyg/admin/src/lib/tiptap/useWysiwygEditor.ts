import { useEffect, useMemo, useRef } from 'react';
import { useEditor, type Editor } from '@tiptap/react';
import { isEmptyHtml, normalizeWysiwygHtml } from '@ortha-cms/wysiwyg-core';
import { buildExtensions } from './extensions';

/**
 * The TipTap editor behind the field, wrapped in the **value contract** the
 * form already had: HTML in, HTML out, `''` when the document is empty.
 *
 * Two things happen here that are the whole reason this is a hook rather than a
 * bare `useEditor` call.
 *
 * **The value leaves through `normalizeWysiwygHtml`.** That is the same parse →
 * sanitize → serialize pass the server runs on every write, so the string this
 * field emits is already canonical: the sanitizer's allow-list is applied
 * before the value is ever sent, the same content stores byte-identically
 * however it was written, and markup no block type corresponds to is reduced to
 * markup the editor can show. It also means the TipTap schema only has to be
 * *parseable* by core, never byte-identical with it — a much weaker thing to
 * get right, and one core is already tested for.
 *
 * **An incoming `value` equal to our own last output is ignored.** It is our
 * change coming back through the form, and re-seeding the editor with it would
 * reset the caret on every keystroke. A genuinely different one re-seeds (and
 * takes the undo history with it — a replaced value is a different document,
 * and Ctrl+Z must not paste the previous record into this one).
 */
export function useWysiwygEditor({
    value,
    onChange,
    onBlur,
    readOnly,
    placeholder
}: {
    value: string;
    onChange(html: string): void;
    onBlur?(): void;
    readOnly: boolean;
    placeholder?: string;
}): Editor | null {
    /** The last HTML this editor emitted, to recognise its own echo. */
    const emitted = useRef<string>(value);
    /** Held in a ref so changing the handler never re-creates the editor. */
    const notify = useRef(onChange);
    notify.current = onChange;
    const blurred = useRef(onBlur);
    blurred.current = onBlur;

    const extensions = useMemo(
        () => buildExtensions({ placeholder }),
        [placeholder]
    );

    const editor = useEditor(
        {
            extensions,
            content: value,
            editable: !readOnly,
            // React 19 + StrictMode: TipTap must not render immediately, or the
            // first paint happens against a DOM node React is about to replace.
            immediatelyRender: false,
            onUpdate({ editor: instance }) {
                const html = serialize(instance);
                if (html === emitted.current) return;
                emitted.current = html;
                notify.current(html);
            },
            onBlur() {
                blurred.current?.();
            }
        },
        [extensions]
    );

    // Value → editor, and only when it is genuinely someone else's change.
    useEffect(() => {
        if (!editor || editor.isDestroyed) return;
        if (value === emitted.current) return;
        emitted.current = value;
        editor.commands.setContent(value, { emitUpdate: false });
    }, [editor, value]);

    useEffect(() => {
        if (editor && !editor.isDestroyed) editor.setEditable(!readOnly);
    }, [editor, readOnly]);

    return editor;
}

/**
 * The document as the field's value.
 *
 * `''` rather than `<p></p>` for an empty document: otherwise every untouched
 * field would read as filled in, and a `required` rule would pass on nothing.
 */
export function serialize(editor: Editor): string {
    const html = normalizeWysiwygHtml(editor.getHTML());
    return isEmptyHtml(html) ? '' : html;
}
