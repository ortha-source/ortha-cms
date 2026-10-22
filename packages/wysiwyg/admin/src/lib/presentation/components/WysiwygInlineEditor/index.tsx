import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { EditorContent, useEditor } from '@tiptap/react';
import { Maximize2 } from 'lucide-react';
import {
    inspectRichText,
    type RichTextDocument
} from '@orthacms/content-domain';
import { Button, cn } from '@orthacms/design-system';
import type { EntryFieldControlContext } from '@orthacms/content-admin';
import { WYSIWYG_PROSE_CLASS } from '../../../domain/constants';
import {
    asEditorContent,
    normalizeRichText
} from '../../../domain/richTextValue';
import { editorExtensions } from '../../../infrastructure/editorExtensions';
import { transformPastedHTML } from '../../../infrastructure/transformPastedHTML';
import { useLiveEditorState } from '../../hooks/useLiveEditorState';
import { WysiwygIssueList } from '../WysiwygIssueList';
import { WysiwygToolbar } from '../WysiwygToolbar';

const messages = defineMessages({
    editorLabel: {
        id: 'wysiwyg.editor.label',
        defaultMessage: '{field} content'
    },
    placeholder: {
        id: 'wysiwyg.inline.placeholder',
        defaultMessage: 'Start writing…'
    },
    expand: {
        id: 'wysiwyg.inline.expand',
        defaultMessage: 'Expand {label}'
    }
});

/**
 * Where focus may go without the toolbar folding away: a menu, a popover or a
 * dialog the toolbar itself opened. They portal out of the field, so "focus
 * left the field" alone would hide the toolbar under its own open menu.
 */
const TOOLBAR_LAYERS =
    '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="menu"]';

/**
 * A `richtext` field **edited in place**, in the entry form (ADR-0022): a
 * click puts the caret in the body, the toolbar appears once the field has
 * focus, and a long body scrolls inside a 480px cap instead of pushing the
 * rest of the form away. **Expand** still opens the full view
 * (`WysiwygFieldFullView`) for the long sitting.
 *
 * The editor is seeded once at mount and owns its state from then on, like
 * the full view's. The one exception is a value that changes **from outside**
 * — "Load the newer version", a revert — which is put into the document
 * without echoing it back as an edit. An edit's own value is recognised by
 * identity: the form stores the very object this hands it.
 *
 * The document carries the field's `id`, so the form's jump to an invalid
 * field and the full view's **Done** both land the caret here.
 */
export function WysiwygInlineEditor({
    field,
    id,
    label,
    value,
    error,
    describedBy,
    onChange,
    onBlur,
    setExpanded
}: EntryFieldControlContext) {
    const intl = useIntl();
    const rootRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);

    const onChangeRef = useRef(onChange);
    const onBlurRef = useRef(onBlur);
    useEffect(() => {
        onChangeRef.current = onChange;
        onBlurRef.current = onBlur;
    });
    /** The last value this editor wrote, to tell its own edits from outside ones. */
    const emitted = useRef<unknown>(value);

    const authored = field.admin['placeholder'];
    const placeholder =
        typeof authored === 'string' && authored !== ''
            ? authored
            : intl.formatMessage(messages.placeholder);

    const editor = useEditor({
        extensions: editorExtensions(placeholder),
        content: asEditorContent(value),
        editorProps: {
            attributes: {
                id,
                class: `${WYSIWYG_PROSE_CLASS} min-h-24 px-4 py-3 outline-none`,
                role: 'textbox',
                'aria-multiline': 'true',
                'aria-required': String(!!field.required),
                'aria-invalid': String(!!error),
                'aria-label': intl.formatMessage(messages.editorLabel, {
                    field: label
                }),
                ...(describedBy ? { 'aria-describedby': describedBy } : {})
            },
            transformPastedHTML
        },
        onUpdate: ({ editor: instance }) => {
            const next = normalizeRichText(
                instance.getJSON() as RichTextDocument
            );
            emitted.current = next;
            onChangeRef.current(next);
        },
        onBlur: () => onBlurRef.current?.()
    });

    // A value set from outside the editor replaces the document — without an
    // update event, so it is not written back as though the author typed it.
    useEffect(() => {
        if (value === emitted.current || editor.isDestroyed) return;
        emitted.current = value;
        editor.commands.setContent(asEditorContent(value), {
            emitUpdate: false
        });
    }, [value, editor]);

    // `aria-invalid` / `aria-describedby` follow the field's error after
    // mount; TipTap reads `editorProps` once.
    useEffect(() => {
        if (editor.isDestroyed) return;
        const dom = editor.view.dom;
        dom.setAttribute('aria-invalid', String(!!error));
        if (describedBy) dom.setAttribute('aria-describedby', describedBy);
        else dom.removeAttribute('aria-describedby');
    }, [editor, error, describedBy]);

    // The toolbar shows from the first focus until focus settles somewhere
    // that is neither this field nor a layer the toolbar opened.
    useEffect(() => {
        if (!active) return;
        const onFocusIn = (event: FocusEvent) => {
            const target = event.target as Element | null;
            if (!target || rootRef.current?.contains(target)) return;
            if (target.closest(TOOLBAR_LAYERS)) return;
            setActive(false);
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
    }, [active]);

    const issues = useLiveEditorState(
        editor,
        (instance) => inspectRichText(instance.getJSON()),
        []
    );

    return (
        <div
            ref={rootRef}
            onFocus={() => setActive(true)}
            className={cn(
                'overflow-hidden rounded-lg border border-input bg-card transition-[box-shadow]',
                'focus-within:ring-2',
                error
                    ? 'border-destructive focus-within:ring-destructive/30'
                    : 'focus-within:border-primary focus-within:ring-primary/15'
            )}
            data-testid={`wysiwyg-inline-${field.name}`}
        >
            {active ? <WysiwygToolbar editor={editor} /> : null}
            <div className="relative max-h-[480px] overflow-y-auto">
                <EditorContent editor={editor} />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-1.5 size-7 text-muted-foreground"
                    aria-label={intl.formatMessage(messages.expand, { label })}
                    title={intl.formatMessage(messages.expand, { label })}
                    onClick={() => setExpanded(true)}
                >
                    <Maximize2 className="size-3.5" aria-hidden />
                </Button>
            </div>
            <WysiwygIssueList issues={issues} />
        </div>
    );
}
