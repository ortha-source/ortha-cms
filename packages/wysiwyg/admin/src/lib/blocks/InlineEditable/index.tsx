import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    type KeyboardEvent,
    type ClipboardEvent
} from 'react';
import {
    parseBlocks,
    sanitizeInlineHtml,
    type BlockPath
} from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import { KEY, SHORTCUT_KEY, pathKey } from '../../utils/constants';
import {
    caretAtEnd,
    caretAtStart,
    deleteBeforeCaret,
    placeCaret,
    placeCaretAtOffset,
    selectionRect,
    splitAtCaret,
    textBeforeCaret
} from '../../utils/dom-selection';
import {
    MARK,
    insertInlineHtml,
    toggleCodeMark,
    toggleMark
} from '../../utils/marks';
import { matchInputRule, matchSlashQuery } from '../../utils/input-rules';

/** The element an editable renders as — headings keep their semantic tag. */
type EditableTag = 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'span';

/**
 * One block's editable text. **The** interactive primitive of the editor: every
 * block that holds words — paragraph, heading, list item, quote, callout,
 * toggle summary, image caption — renders one of these, so Enter, Backspace,
 * Tab, the arrow keys, the markdown rules, the slash menu and paste all behave
 * identically wherever the author is typing, and are implemented once.
 *
 * It is an **uncontrolled** `contenteditable` with a controlled model behind
 * it. The DOM is only written to when it genuinely differs from the model
 * (a structural edit, an external value change) — never on the author's own
 * keystrokes, because rewriting `innerHTML` under a live caret sends it to the
 * end of the block. The model, in turn, holds whatever markup the browser
 * produced; it is sanitized on the way *out* (serialization), which is why
 * typing never fights the sanitizer.
 */
export function InlineEditable({
    path,
    html,
    placeholder,
    className,
    as: Tag = 'div',
    ariaLabel
}: {
    path: BlockPath;
    html: string;
    placeholder?: string;
    className?: string;
    as?: EditableTag;
    /** Accessible name — every editable region needs one. */
    ariaLabel: string;
}) {
    const {
        commands,
        readOnly,
        focusRequest,
        setSlash,
        handleOverlayKey,
        refreshToolbar,
        openLinkEditor,
        registerEditable,
        undo,
        redo
    } = useEditor();
    const ref = useRef<HTMLElement>(null);
    const key = pathKey(path);

    useLayoutEffect(() => {
        registerEditable(key, ref.current);
        return () => registerEditable(key, null);
    }, [key, registerEditable]);

    // Model → DOM, and only when they differ. The guard is the whole reason
    // typing doesn't lose the caret.
    useEffect(() => {
        const element = ref.current;
        if (element && element.innerHTML !== html) element.innerHTML = html;
    }, [html]);

    // A command elsewhere asked for the caret to land in this block.
    //
    // The dependency is the path **key**, not the path array. `path` is rebuilt
    // (`[...basePath, index]`) on every render, so depending on it re-ran this
    // effect after every keystroke and re-placed the caret at the start of the
    // block — which types text out backwards, and starves the input rules and
    // the slash menu of the text before the caret they read.
    useEffect(() => {
        const element = ref.current;
        if (!element || !focusRequest) return;
        if (pathKey(focusRequest.path) !== key) return;
        if (typeof focusRequest.at === 'number') {
            placeCaretAtOffset(element, focusRequest.at);
        } else {
            placeCaret(element, focusRequest.at);
        }
    }, [focusRequest, key]);

    const handleInput = useCallback(() => {
        const element = ref.current;
        if (!element) return;
        const before = textBeforeCaret(element);

        // A markdown shortcut just completed: drop the trigger characters and
        // convert, in one commit (see `applyBlockType`).
        const rule = matchInputRule(before);
        if (rule) {
            deleteBeforeCaret(rule.consumed);
            setSlash(null);
            commands.applyBlockType(
                path,
                rule.type,
                rule.attrs,
                element.innerHTML
            );
            return;
        }

        const query = matchSlashQuery(before);
        const rect = query === null ? null : selectionRect();
        setSlash(rect ? { path, query: query ?? '', rect } : null);
        commands.setHtml(path, element.innerHTML);
    }, [commands, path, setSlash]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            const element = ref.current;
            if (!element) return;
            // An open overlay owns the navigation keys while it is showing.
            if (handleOverlayKey(event)) return;

            if (event.metaKey || event.ctrlKey) {
                const handled = applyShortcut(event, {
                    openLinkEditor,
                    refreshToolbar,
                    undo,
                    redo
                });
                if (handled) event.preventDefault();
                return;
            }

            switch (event.key) {
                case KEY.Enter: {
                    event.preventDefault();
                    if (event.shiftKey) {
                        // A soft break inside the same block, not a new one.
                        insertInlineHtml('<br>');
                        commands.setHtml(path, element.innerHTML);
                        return;
                    }
                    const { before, after } = splitAtCaret(element);
                    commands.split(path, before, after);
                    return;
                }
                case KEY.Backspace: {
                    if (!caretAtStart(element)) return;
                    event.preventDefault();
                    commands.mergeBackward(path);
                    return;
                }
                case KEY.Delete: {
                    if (!caretAtEnd(element)) return;
                    event.preventDefault();
                    commands.mergeForward(path);
                    return;
                }
                case KEY.Tab: {
                    event.preventDefault();
                    if (event.shiftKey) commands.outdent(path);
                    else commands.indent(path);
                    return;
                }
                case KEY.ArrowUp: {
                    if (!caretAtStart(element)) return;
                    event.preventDefault();
                    commands.focusNeighbour(path, -1);
                    return;
                }
                case KEY.ArrowDown: {
                    if (!caretAtEnd(element)) return;
                    event.preventDefault();
                    commands.focusNeighbour(path, 1);
                    return;
                }
                case KEY.Escape: {
                    setSlash(null);
                    return;
                }
                default:
                    return;
            }
        },
        [
            commands,
            handleOverlayKey,
            openLinkEditor,
            path,
            redo,
            refreshToolbar,
            setSlash,
            undo
        ]
    );

    /**
     * Paste is where content arrives from everywhere else — Word, a browser, a
     * different CMS. Multi-block HTML becomes real blocks rather than one
     * paragraph of flattened markup; anything else is inserted inline, always
     * sanitized first.
     */
    const handlePaste = useCallback(
        (event: ClipboardEvent<HTMLElement>) => {
            const element = ref.current;
            if (!element) return;
            const pastedHtml = event.clipboardData.getData('text/html');
            const pastedText = event.clipboardData.getData('text/plain');
            if (!pastedHtml && !pastedText) return;
            event.preventDefault();

            if (pastedHtml) {
                const blocks = parseBlocks(pastedHtml);
                if (blocks.length > 1) {
                    commands.insertAfter(path, blocks);
                    return;
                }
                insertInlineHtml(sanitizeInlineHtml(blocks[0]?.html ?? ''));
            } else {
                // Plain text goes in as text — `document.execCommand('insertText')`
                // escapes it, so a pasted `<script>` is five visible characters.
                document.execCommand('insertText', false, pastedText);
            }
            commands.setHtml(path, element.innerHTML);
        },
        [commands, path]
    );

    const Element = Tag as 'div';
    return (
        <Element
            ref={ref as React.Ref<HTMLDivElement>}
            role="textbox"
            aria-multiline="true"
            aria-label={ariaLabel}
            data-editable={key}
            data-empty={html === ''}
            data-placeholder={placeholder}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            spellCheck
            className={cn(
                'min-w-0 outline-none',
                // The placeholder is drawn, not stored: an empty block has no
                // text at all, so there is nothing to strip before saving.
                'data-[empty=true]:before:text-muted-foreground data-[empty=true]:before:pointer-events-none data-[empty=true]:before:content-[attr(data-placeholder)]',
                'focus-visible:outline-none',
                className
            )}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onMouseUp={refreshToolbar}
            onKeyUp={refreshToolbar}
        />
    );
}

/** Runs a ⌘/Ctrl shortcut. Returns whether it was one. */
function applyShortcut(
    event: KeyboardEvent<HTMLElement>,
    actions: {
        openLinkEditor(): void;
        refreshToolbar(): void;
        undo(): void;
        redo(): void;
    }
): boolean {
    const key = event.key.toLowerCase();
    switch (key) {
        case SHORTCUT_KEY.Bold:
            toggleMark(MARK.Bold);
            break;
        case SHORTCUT_KEY.Italic:
            toggleMark(MARK.Italic);
            break;
        case SHORTCUT_KEY.Underline:
            toggleMark(MARK.Underline);
            break;
        case SHORTCUT_KEY.Strike:
            toggleMark(MARK.Strike);
            break;
        case SHORTCUT_KEY.Code:
            toggleCodeMark();
            break;
        case SHORTCUT_KEY.Link:
            actions.openLinkEditor();
            break;
        case SHORTCUT_KEY.Undo:
            if (event.shiftKey) actions.redo();
            else actions.undo();
            break;
        default:
            return false;
    }
    actions.refreshToolbar();
    return true;
}
