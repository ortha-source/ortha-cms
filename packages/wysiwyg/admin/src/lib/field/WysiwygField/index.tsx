import { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Minimize2 } from 'lucide-react';
import { htmlToPlainText } from '@ortha-cms/wysiwyg-core';
import { Button } from '@ortha-cms/design-system';
import {
    WysiwygEditor,
    type WysiwygEditorProps
} from '../../editor/WysiwygEditor';
import { WysiwygPreviewCard } from '../WysiwygPreviewCard';
import { KEY } from '../../utils/constants';

const messages = defineMessages({
    collapse: {
        id: 'wysiwyg.field.collapse',
        defaultMessage: 'Done'
    },
    collapseHint: {
        id: 'wysiwyg.field.collapseHint',
        defaultMessage: 'Close the editor and go back to the preview'
    },
    region: {
        id: 'wysiwyg.field.region',
        defaultMessage: '{label} — editing'
    },
    words: {
        id: 'wysiwyg.field.words',
        defaultMessage: '{count, plural, one {# word} other {# words}}'
    }
});

/** Props of the wysiwyg form control. */
export interface WysiwygFieldProps
    extends Omit<WysiwygEditorProps, 'className'> {
    /** The field's label — the preview's fallback title and the editor's heading. */
    label: string;
}

/**
 * The wysiwyg **form control**: a preview of the document that expands into the
 * editor when pressed.
 *
 * It expands **in place**, taking over the page's work area — it is not an
 * overlay and not a modal. The app chrome (sidebar, top bar, the record's own
 * tabs) stays visible and usable throughout, because writing a body is part of
 * editing the record, not a detour away from it. That also removes a whole
 * class of modal problems the overlay version had: inert backgrounds swallowing
 * clicks on the floating menus, and a transformed dialog re-basing their
 * viewport coordinates.
 *
 * Collapsed, the field shows what is written and how much of it; expanded, the
 * writing gets a page-sized surface with room for the block gutter and a
 * comfortable measure. Edits commit **live** to the same `onChange` — collapsing
 * is not a save, the form's own Save still is.
 */
export function WysiwygField({
    label,
    value,
    onChange,
    onBlur,
    readOnly = false,
    invalid = false,
    id,
    'aria-describedby': describedBy,
    ...editorProps
}: WysiwygFieldProps) {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const regionRef = useRef<HTMLDivElement>(null);

    // Expanding brings the surface into view — `nearest`, not `start`: the work
    // area has a **sticky top bar**, and scrolling the editor's top edge to the
    // container's top tucks its first line underneath it. The caret is left
    // alone, so the author lands looking at the whole document rather than
    // inside one block.
    useEffect(() => {
        if (expanded) {
            regionRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [expanded]);

    const collapse = useCallback(() => {
        setExpanded(false);
        onBlur?.();
        // Focus returns to the control that opened the editor — the reader's
        // place in the form, not the top of the document.
        window.requestAnimationFrame(() => {
            cardRef.current?.querySelector('button')?.focus();
        });
    }, [onBlur]);

    if (!expanded) {
        return (
            <div ref={cardRef}>
                <WysiwygPreviewCard
                    id={id}
                    html={value}
                    label={label}
                    readOnly={readOnly}
                    invalid={invalid}
                    describedBy={describedBy}
                    onOpen={() => setExpanded(true)}
                />
            </div>
        );
    }

    const words = wordCount(value);

    return (
        <section
            ref={regionRef}
            aria-label={intl.formatMessage(messages.region, { label })}
            className="bg-background overflow-hidden rounded-md border"
            onKeyDown={(event) => {
                // Escape leaves the editor — but only when nothing inside has
                // claimed it first (the slash menu and the link field both do).
                if (event.key !== KEY.Escape || event.defaultPrevented) return;
                event.preventDefault();
                collapse();
            }}
        >
            <div className="bg-muted/30 flex items-center gap-3 border-b px-4 py-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                    {intl.formatMessage(messages.words, { count: words })}
                </span>
                <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title={intl.formatMessage(messages.collapseHint)}
                    onClick={collapse}
                >
                    <Minimize2 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.collapse)}
                </Button>
            </div>
            {/* Tall enough to read as a writing surface rather than a form
                field, but bounded — the page still scrolls as one document. */}
            <div className="min-h-[60vh] px-4 py-8">
                <div className="mx-auto max-w-3xl">
                    <WysiwygEditor
                        {...editorProps}
                        value={value}
                        onChange={onChange}
                        readOnly={readOnly}
                        invalid={invalid}
                        aria-describedby={describedBy}
                        // The section already draws the frame; a second border
                        // around the writing surface just boxes it in twice.
                        className="border-none bg-transparent"
                    />
                </div>
            </div>
        </section>
    );
}

/** Words in the document — the size measure shown beside the label. */
function wordCount(html: string): number {
    const text = htmlToPlainText(html ?? '').trim();
    return text === '' ? 0 : text.split(/\s+/).length;
}
