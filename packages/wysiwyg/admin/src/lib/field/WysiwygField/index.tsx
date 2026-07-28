import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Minimize2 } from 'lucide-react';
import { htmlToPlainText } from '@ortha-cms/wysiwyg-core';
import { Button, cn } from '@ortha-cms/design-system';
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
        defaultMessage: 'Close the editor and go back to the form'
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
    /**
     * Where to render the editor when it is expanded. Given a node, the editor
     * **takes over that region** — the host is expected to hide whatever else
     * was there. Without one it expands in place instead, so the control stays
     * usable in a form that offers no such region.
     */
    expandTo?: HTMLElement | null;
    /** Told whenever the editor expands or collapses, so a host can react. */
    onExpandedChange?(expanded: boolean): void;
}

/**
 * The wysiwyg **form control**: a preview of the document that expands into the
 * editor when pressed.
 *
 * Given an `expandTo` region, the editor **becomes the work area** — the other
 * fields go away and the app chrome (sidebar, top bar, the record's tabs) stays.
 * Writing a body is a mode, not a detour: everything else on the form is noise
 * while it is happening, and none of the chrome you navigate with is.
 *
 * It is a **portal**, not a modal. A modal would make the page inert (the
 * floating menus rendered and then refused clicks) and, being transformed,
 * would re-base their `position: fixed` coordinates. A portal moves only the
 * DOM: the control stays inside the form's React tree, so the value it edits is
 * still the form's state, and collapsing puts the form back untouched.
 *
 * Edits commit **live** to the same `onChange` — collapsing is not a save, the
 * form's own Save still is.
 */
export function WysiwygField({
    label,
    value,
    onChange,
    onBlur,
    readOnly = false,
    invalid = false,
    id,
    expandTo,
    onExpandedChange,
    'aria-describedby': describedBy,
    ...editorProps
}: WysiwygFieldProps) {
    const intl = useIntl();
    const [expanded, setExpanded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const notify = useRef(onExpandedChange);
    notify.current = onExpandedChange;

    // Releasing the region on unmount matters: navigating away mid-edit would
    // otherwise leave the page showing an empty region over a hidden form.
    useEffect(() => () => notify.current?.(false), []);

    const expand = useCallback(() => {
        setExpanded(true);
        onExpandedChange?.(true);
    }, [onExpandedChange]);

    const collapse = useCallback(() => {
        setExpanded(false);
        onExpandedChange?.(false);
        onBlur?.();
        // Focus returns to the control that opened the editor — the reader's
        // place in the form, not the top of the page. A frame later, because
        // the form is `display: none` until this render lands and a hidden
        // element cannot take focus.
        window.requestAnimationFrame(() => {
            cardRef.current?.querySelector('button')?.focus();
        });
    }, [onBlur, onExpandedChange]);

    const card = (
        <div ref={cardRef}>
            <WysiwygPreviewCard
                id={id}
                html={value}
                label={label}
                readOnly={readOnly}
                invalid={invalid}
                describedBy={describedBy}
                onOpen={expand}
            />
        </div>
    );

    if (!expanded) return card;

    const takesOver = !!expandTo;
    const panel = (
        <section
            aria-label={intl.formatMessage(messages.region, { label })}
            className={cn(
                'bg-background flex min-h-0 flex-col',
                // Filling a region: own its whole height, and let the body
                // scroll rather than the page behind it.
                takesOver ? 'h-full flex-1' : 'overflow-hidden rounded-md border'
            )}
            onKeyDown={(event) => {
                // Escape leaves the editor — but only when nothing inside has
                // claimed it first (the slash menu and the link field both do).
                if (event.key !== KEY.Escape || event.defaultPrevented) return;
                event.preventDefault();
                collapse();
            }}
        >
            <div
                className={cn(
                    'flex shrink-0 items-center gap-3 border-b px-6 py-2.5',
                    !takesOver && 'bg-muted/30 px-4 py-2'
                )}
            >
                <span className="text-sm font-medium">{label}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                    {intl.formatMessage(messages.words, {
                        count: wordCount(value)
                    })}
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
            <div
                className={cn(
                    takesOver ? 'min-h-0 flex-1' : 'min-h-[60vh] p-4'
                )}
            >
                <WysiwygEditor
                    {...editorProps}
                    value={value}
                    onChange={onChange}
                    readOnly={readOnly}
                    invalid={invalid}
                    aria-describedby={describedBy}
                    // Filling the region, the editor owns the toolbar and the
                    // scrolling: the bar has to stay put while the document
                    // moves under it, which only works if the same component
                    // holds both.
                    toolbar={takesOver}
                    className={takesOver ? undefined : 'border-none bg-transparent'}
                />
            </div>
        </section>
    );

    // The card stays rendered (hidden with the rest of the form) so collapsing
    // has somewhere to put focus back.
    return takesOver ? (
        <>
            {card}
            {createPortal(panel, expandTo)}
        </>
    ) : (
        panel
    );
}

/** Words in the document — the size measure shown beside the label. */
function wordCount(html: string): number {
    const text = htmlToPlainText(html ?? '').trim();
    return text === '' ? 0 : text.split(/\s+/).length;
}
