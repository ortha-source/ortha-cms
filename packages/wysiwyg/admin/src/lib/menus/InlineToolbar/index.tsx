import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { defineMessages, useIntl } from 'react-intl';
import {
    Bold,
    Code,
    Italic,
    Link as LinkIcon,
    Strikethrough,
    Underline
} from 'lucide-react';

import {
    MARK,
    applyLink,
    isCodeMarkActive,
    isMarkActive,
    linkAtCaret,
    removeLink,
    toggleCodeMark,
    toggleMark,
    type Mark
} from '../../utils/marks';
import {
    currentSelection,
    hasTextSelection,
    selectionRect
} from '../../utils/dom-selection';
import { LinkForm } from './LinkForm';
import { ToolbarButton } from './ToolbarButton';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.toolbar.label',
        defaultMessage: 'Text formatting'
    },
    bold: { id: 'wysiwyg.toolbar.bold', defaultMessage: 'Bold' },
    italic: { id: 'wysiwyg.toolbar.italic', defaultMessage: 'Italic' },
    underline: {
        id: 'wysiwyg.toolbar.underline',
        defaultMessage: 'Underline'
    },
    strike: {
        id: 'wysiwyg.toolbar.strike',
        defaultMessage: 'Strikethrough'
    },
    code: { id: 'wysiwyg.toolbar.code', defaultMessage: 'Inline code' },
    link: { id: 'wysiwyg.toolbar.link', defaultMessage: 'Link' }
});

/** Gap between the toolbar and the selection it points at. */
const TOOLBAR_MARGIN = 8;

/** Space above a selection the toolbar needs to sit there at all. */
const TOOLBAR_CLEARANCE = 48;

/** What the toolbar is showing about the current selection. */
interface ToolbarState {
    readonly rect: DOMRect;
    readonly marks: Readonly<Record<string, boolean>>;
    readonly code: boolean;
    readonly link: string | null;
}

/**
 * The floating format toolbar that appears over a text selection.
 *
 * It reads the selection rather than being told about it — from
 * `selectionchange` (the selection moved) **and** from a `version` counter the
 * editor bumps (a shortcut changed the *marks* without moving the selection,
 * which fires no event of its own). Every button suppresses `mousedown`, so
 * pressing one never collapses the selection it is about to format.
 */
export function InlineToolbar({
    containerRef,
    container,
    version,
    linkRequest
}: {
    /** The editor root — selections outside it are none of our business. */
    containerRef: RefObject<HTMLElement | null>;
    /** Where to portal to. The editor root, so a modal can't make it inert. */
    container: HTMLElement | null;
    /** Bumped by the editor to force a re-read (after a mark shortcut). */
    version: number;
    /** Bumped by ⌘K to open the link field. */
    linkRequest: number;
}) {
    const intl = useIntl();
    const [state, setState] = useState<ToolbarState | null>(null);
    const [linkDraft, setLinkDraft] = useState<string | null>(null);
    const savedRange = useRef<Range | null>(null);
    /** Whether the URL field is showing — read from inside `read`. */
    const linkOpen = useRef(false);
    linkOpen.current = linkDraft !== null;

    const read = useCallback(() => {
        // While the URL field is open it holds focus **on purpose**, which
        // means there is no selection to read. Recomputing here would find
        // none, hide the toolbar, and take the half-typed URL with it — so
        // the saved range stands until the field is applied or cancelled.
        if (linkOpen.current) return;
        const container = containerRef.current;
        const selection = currentSelection();
        const anchor = selection?.anchorNode;
        if (!container || !anchor || !container.contains(anchor)) {
            setState(null);
            return;
        }
        if (!hasTextSelection()) {
            setState(null);
            return;
        }
        const rect = selectionRect();
        if (!rect) {
            setState(null);
            return;
        }
        setState({
            rect,
            marks: {
                [MARK.Bold]: isMarkActive(MARK.Bold),
                [MARK.Italic]: isMarkActive(MARK.Italic),
                [MARK.Underline]: isMarkActive(MARK.Underline),
                [MARK.Strike]: isMarkActive(MARK.Strike)
            },
            code: isCodeMarkActive(),
            link: linkAtCaret()
        });
    }, [containerRef]);

    useEffect(() => {
        document.addEventListener('selectionchange', read);
        return () => document.removeEventListener('selectionchange', read);
    }, [read]);

    useEffect(() => {
        read();
    }, [read, version]);

    const startLink = useCallback(() => {
        const selection = currentSelection();
        savedRange.current = selection?.getRangeAt(0).cloneRange() ?? null;
        setLinkDraft(linkAtCaret() ?? '');
    }, []);

    useEffect(() => {
        if (linkRequest > 0) startLink();
    }, [linkRequest, startLink]);

    /** Puts the caret back where it was before the URL field took focus. */
    const restoreSelection = useCallback(() => {
        const range = savedRange.current;
        if (!range) return;
        const host =
            range.startContainer.nodeType === Node.ELEMENT_NODE
                ? (range.startContainer as HTMLElement)
                : range.startContainer.parentElement;
        host?.closest<HTMLElement>('[data-editable]')?.focus();
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }, []);

    if (!state) return null;

    const runMark = (mark: Mark) => {
        toggleMark(mark);
        read();
    };

    // Above the selection by default, below it when there isn't room — a bar
    // pinned to `top: 8` and then translated up by its own height lands off
    // the top of the viewport, i.e. exactly when the author is editing the
    // first line of the document.
    const flipBelow = state.rect.top < TOOLBAR_CLEARANCE;
    const style = {
        left: Math.max(TOOLBAR_MARGIN, state.rect.left + state.rect.width / 2),
        top: flipBelow
            ? state.rect.bottom + TOOLBAR_MARGIN
            : state.rect.top - TOOLBAR_MARGIN,
        transform: flipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
    };

    return createPortal(
        <div
            role="toolbar"
            aria-label={intl.formatMessage(messages.label)}
            style={style}
            className="bg-popover text-popover-foreground fixed z-50 flex items-center rounded-md border shadow-md"
            // The whole bar suppresses mousedown: a click anywhere on it (even
            // its padding) would otherwise drop the selection being formatted.
            onMouseDown={(event) => event.preventDefault()}
        >
            {linkDraft === null ? (
                <div className="flex items-center gap-0.5 p-1">
                    <ToolbarButton
                        label={intl.formatMessage(messages.bold)}
                        active={state.marks[MARK.Bold]}
                        onClick={() => runMark(MARK.Bold)}
                    >
                        <Bold aria-hidden className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        label={intl.formatMessage(messages.italic)}
                        active={state.marks[MARK.Italic]}
                        onClick={() => runMark(MARK.Italic)}
                    >
                        <Italic aria-hidden className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        label={intl.formatMessage(messages.underline)}
                        active={state.marks[MARK.Underline]}
                        onClick={() => runMark(MARK.Underline)}
                    >
                        <Underline aria-hidden className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        label={intl.formatMessage(messages.strike)}
                        active={state.marks[MARK.Strike]}
                        onClick={() => runMark(MARK.Strike)}
                    >
                        <Strikethrough aria-hidden className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        label={intl.formatMessage(messages.code)}
                        active={state.code}
                        onClick={() => {
                            toggleCodeMark();
                            read();
                        }}
                    >
                        <Code aria-hidden className="size-4" />
                    </ToolbarButton>
                    <ToolbarButton
                        label={intl.formatMessage(messages.link)}
                        active={state.link !== null}
                        onClick={startLink}
                    >
                        <LinkIcon aria-hidden className="size-4" />
                    </ToolbarButton>
                </div>
            ) : (
                <LinkForm
                    value={linkDraft}
                    hasLink={state.link !== null}
                    onChange={setLinkDraft}
                    onSubmit={() => {
                        restoreSelection();
                        if (linkDraft.trim()) applyLink(linkDraft.trim());
                        setLinkDraft(null);
                        read();
                    }}
                    onRemove={() => {
                        restoreSelection();
                        removeLink();
                        setLinkDraft(null);
                        read();
                    }}
                    onCancel={() => {
                        restoreSelection();
                        setLinkDraft(null);
                    }}
                />
            )}
        </div>,
        container ?? document.body
    );
}
