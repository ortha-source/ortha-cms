import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type FocusEvent,
    type KeyboardEvent
} from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    BLOCK_ALIGN,
    DEFAULT_BLOCK_SCHEMA,
    INLINE_MARK_TAG,
    PARAGRAPH_TYPE,
    blockAt,
    blockRangeBetween,
    createBlock,
    extendBlockSchema,
    type BlockAlign,
    type BlockDefinition,
    type BlockPath,
    type BlockSchema,
    type InlineMarkTag
} from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { BlockGutter } from '../../blocks/BlockGutter';
import { BlockList } from '../../blocks/BlockList';
import { DEFAULT_BLOCK_VIEWS } from '../../blocks/defaultBlockViews';
import type { BlockViewRegistry } from '../../blocks/blockRegistry';
import type { WysiwygMediaPort } from '../../media/wysiwygMedia';
import { WYSIWYG_INLINE_PROSE } from '../../render/wysiwygProse';
import { EditorToolbar } from '../../menus/EditorToolbar';
import { InlineToolbar } from '../../menus/InlineToolbar';
import { SlashMenu } from '../../menus/SlashMenu';
import {
    filterBlockTypeGroups,
    flattenBlockTypeGroups,
    useBlockTypeItems,
    type BlockTypeItem
} from '../../menus/useBlockTypeItems';
import { CARET, KEY, SHORTCUT_KEY, pathKey } from '../../utils/constants';
import { deleteBeforeCaret } from '../../utils/dom-selection';
import { EditorProvider, type SlashState } from '../editorContext';
import { useBlockCommands } from '../useBlockCommands';
import { useEditorDocument } from '../useEditorDocument';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.editor.label',
        defaultMessage: 'Rich text editor'
    }
});

/** ⌘-shortcuts that toggle a mark across a whole block selection. */
/** The alignment each ⌘⇧ shortcut applies. */
const ALIGN_SHORTCUTS: Record<string, BlockAlign> = {
    [SHORTCUT_KEY.AlignLeft]: BLOCK_ALIGN.Left,
    [SHORTCUT_KEY.AlignCenter]: BLOCK_ALIGN.Center,
    [SHORTCUT_KEY.AlignRight]: BLOCK_ALIGN.Right,
    [SHORTCUT_KEY.AlignJustify]: BLOCK_ALIGN.Justify
};

const SELECTION_MARKS: Record<string, InlineMarkTag> = {
    [SHORTCUT_KEY.Bold]: INLINE_MARK_TAG.Bold,
    [SHORTCUT_KEY.Italic]: INLINE_MARK_TAG.Italic,
    [SHORTCUT_KEY.Underline]: INLINE_MARK_TAG.Underline,
    [SHORTCUT_KEY.Strike]: INLINE_MARK_TAG.Strike,
    [SHORTCUT_KEY.Code]: INLINE_MARK_TAG.Code
};

/** Props of the block editor. */
export interface WysiwygEditorProps {
    /** The document, as HTML. The editor is fully controlled. */
    value: string;
    /** Called with the new HTML on every edit (`''` when the editor is empty). */
    onChange(html: string): void;
    /** Called when focus leaves the editor entirely — for form `touched` state. */
    onBlur?(): void;
    /** Render the document without any editing affordances. */
    readOnly?: boolean;
    /** Draw the invalid state and set `aria-invalid`. */
    invalid?: boolean;
    /**
     * Extra (or replacement) block **definitions** — the model half of a custom
     * block type. Same `type` as a built-in replaces it.
     */
    blocks?: readonly BlockDefinition[];
    /** Extra (or replacement) block **renderers**, keyed by the same `type`. */
    blockViews?: BlockViewRegistry;
    /**
     * Show the persistent toolbar (undo/redo, block type, marks, insert) and
     * fill the parent's height, scrolling the writing surface under it. For a
     * surface with room for one — the expanded field. Inline in a form, the
     * floating selection toolbar is the whole formatting UI.
     */
    toolbar?: boolean;
    /**
     * The host's media library. Given one, the image block offers "choose from
     * library" alongside pasting a URL. See {@link WysiwygMediaPort}.
     */
    media?: WysiwygMediaPort | null;
    id?: string;
    className?: string;
    'aria-describedby'?: string;
}

/**
 * The Ortha block editor — a Notion/Coda-shaped writing surface whose value is
 * plain **HTML**, in and out.
 *
 * The whole component is a thin shell: the document lives in
 * `useEditorDocument`, the behavior in `useBlockCommands`, the rendering in the
 * block registry. What is left here is the wiring the pieces can't own —
 * the slash menu's open state and keyboard routing, the floating toolbar, and
 * the focus/blur boundary of the editor as a form control.
 */
export function WysiwygEditor({
    value,
    onChange,
    onBlur,
    readOnly = false,
    invalid = false,
    blocks,
    blockViews,
    toolbar = false,
    media = null,
    id,
    className,
    'aria-describedby': describedBy
}: WysiwygEditorProps) {
    const intl = useIntl();
    const rootRef = useRef<HTMLDivElement>(null);
    /** What the travelling gutter measures and positions itself against. */
    const surfaceRef = useRef<HTMLDivElement>(null);
    const editables = useRef(new Map<string, HTMLElement>());
    /**
     * The editor root, as state, because the floating overlays portal **into
     * it** rather than into `document.body`. It sets no `transform`, so their
     * viewport coordinates still resolve against the viewport, and living
     * inside the editor keeps them in whatever tree the editor is mounted in —
     * including one that has been made inert around it.
     */
    const [overlayContainer, setOverlayContainer] =
        useState<HTMLDivElement | null>(null);
    const attachRoot = useCallback((node: HTMLDivElement | null) => {
        rootRef.current = node;
        setOverlayContainer(node);
    }, []);

    const schema: BlockSchema = useMemo(
        () =>
            blocks && blocks.length > 0
                ? extendBlockSchema(DEFAULT_BLOCK_SCHEMA, blocks)
                : DEFAULT_BLOCK_SCHEMA,
        [blocks]
    );
    const views: BlockViewRegistry = useMemo(
        () => ({ ...DEFAULT_BLOCK_VIEWS, ...(blockViews ?? {}) }),
        [blockViews]
    );

    const doc = useEditorDocument({ value, onChange, schema });
    const commands = useBlockCommands(doc, schema);

    const [activePath, setActivePath] = useState<BlockPath | null>(null);
    /** Whole blocks selected as units, by path key. */
    const [selected, setSelected] = useState<readonly BlockPath[]>([]);
    /** The block a pointer-drag started in, while the button is down. */
    const dragAnchor = useRef<BlockPath | null>(null);
    const [slash, setSlash] = useState<SlashState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [toolbarVersion, setToolbarVersion] = useState(0);
    const [linkRequest, setLinkRequest] = useState(0);

    const allGroups = useBlockTypeItems(schema, views);
    const slashGroups = useMemo(
        () => (slash ? filterBlockTypeGroups(allGroups, slash.query) : []),
        [allGroups, slash]
    );
    const slashItems = useMemo(
        () => flattenBlockTypeGroups(slashGroups),
        [slashGroups]
    );
    // The query narrows as the author types, so the highlighted row is clamped
    // rather than kept — an index into a list that just got shorter is nothing.
    const activeItem = slashItems[Math.min(activeIndex, slashItems.length - 1)];

    const openSlash = useCallback((state: SlashState | null) => {
        setSlash(state);
        setActiveIndex(0);
    }, []);

    /**
     * Applies a slash command: remove the `/query` the author typed, then
     * convert or insert — as **one** commit, from the live DOM, because the
     * model still holds the text that is about to disappear.
     */
    const applySlash = useCallback(
        (item: BlockTypeItem) => {
            if (!slash) return;
            const element = editables.current.get(slash.path.join('.'));
            setSlash(null);
            if (!element) return;
            element.focus({ preventScroll: true });
            deleteBeforeCaret(slash.query.length + 1);
            commands.applyBlockType(
                slash.path,
                item.type,
                item.attrs,
                element.innerHTML
            );
        },
        [commands, slash]
    );

    /** The slash menu owns the navigation keys while it is open. */
    const handleOverlayKey = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (!slash) return false;
            switch (event.key) {
                case KEY.ArrowDown:
                    event.preventDefault();
                    setActiveIndex((index) =>
                        slashItems.length === 0
                            ? 0
                            : (index + 1) % slashItems.length
                    );
                    return true;
                case KEY.ArrowUp:
                    event.preventDefault();
                    setActiveIndex((index) =>
                        slashItems.length === 0
                            ? 0
                            : (index - 1 + slashItems.length) %
                              slashItems.length
                    );
                    return true;
                case KEY.Enter:
                case KEY.Tab:
                    if (!activeItem) return false;
                    // A **shifted** Enter is not a choice — it is a soft
                    // break, and it has to reach the block. The menu opens on
                    // any `/` that follows a space, so a line as ordinary as
                    // "see /docs" leaves it up: pressing Shift+Enter there
                    // inserted whatever the menu happened to be highlighting
                    // and started a new block, where the author had asked for
                    // a new line in the one they were writing.
                    if (event.key === KEY.Enter && event.shiftKey) {
                        setSlash(null);
                        return false;
                    }
                    event.preventDefault();
                    applySlash(activeItem);
                    return true;
                case KEY.Escape:
                    event.preventDefault();
                    setSlash(null);
                    return true;
                default:
                    return false;
            }
        },
        [activeItem, applySlash, slash, slashItems.length]
    );

    const registerEditable = useCallback(
        (key: string, element: HTMLElement | null) => {
            if (element) editables.current.set(key, element);
            else editables.current.delete(key);
        },
        []
    );

    const selectedKeys = useMemo(
        () => new Set(selected.map(pathKey)),
        [selected]
    );

    const clearBlockSelection = useCallback(() => setSelected([]), []);

    /**
     * Selects the run between two blocks and takes the caret out of the
     * document: a caret blinking inside one block while five look selected
     * would leave the next keystroke going somewhere the author isn't looking.
     * Focus moves to the editor root, which is where the selection's own
     * keyboard handling lives.
     */
    const selectBlocks = useCallback(
        (anchorPath: BlockPath, focusPath: BlockPath) => {
            setSelected(blockRangeBetween(anchorPath, focusPath));
            window.getSelection()?.removeAllRanges();
            rootRef.current?.focus({ preventScroll: true });
        },
        []
    );

    const selectAllBlocks = useCallback(() => {
        if (doc.blocks.length === 0) return;
        selectBlocks([0], [doc.blocks.length - 1]);
    }, [doc.blocks.length, selectBlocks]);

    /** The block path under an event's target, if it is inside one. */
    const pathUnder = (target: EventTarget | null): BlockPath | null => {
        const key = (target as HTMLElement | null)
            ?.closest?.('[data-block-path]')
            ?.getAttribute('data-block-path');
        return key ? key.split('.').map(Number) : null;
    };

    const context = useMemo(
        () => ({
            schema,
            views,
            commands,
            readOnly,
            media,
            focusRequest: doc.focusRequest,
            activePath,
            // Resolved here rather than stored: the block at a path changes
            // type as the author works, and a cached copy would leave the
            // toolbar naming what the block used to be.
            activeBlockType: activePath
                ? (blockAt(doc.blocks, activePath)?.type ?? null)
                : null,
            activeBlockAttrs: activePath
                ? (blockAt(doc.blocks, activePath)?.attrs ?? null)
                : null,
            setActivePath,
            canUndo: doc.canUndo,
            canRedo: doc.canRedo,
            selectedKeys,
            selectBlocks,
            selectAllBlocks,
            clearBlockSelection,
            setSlash: openSlash,
            handleOverlayKey,
            refreshToolbar: () => setToolbarVersion((version) => version + 1),
            commitActiveHtml: () => {
                if (!activePath) return;
                const element = editables.current.get(pathKey(activePath));
                if (element)
                    commands.replaceHtml(activePath, element.innerHTML);
            },
            openLinkEditor: () => setLinkRequest((request) => request + 1),
            registerEditable,
            editableFor: (key: string) => editables.current.get(key) ?? null,
            undo: doc.undo,
            redo: doc.redo
        }),
        [
            activePath,
            clearBlockSelection,
            commands,
            doc.blocks,
            doc.canRedo,
            doc.canUndo,
            doc.focusRequest,
            doc.redo,
            doc.undo,
            handleOverlayKey,
            media,
            openSlash,
            readOnly,
            registerEditable,
            schema,
            selectAllBlocks,
            selectBlocks,
            selectedKeys,
            views
        ]
    );

    /**
     * Pointer-driven block selection. The browser cannot help here — dragging
     * from one block into the next stops at the first block's boundary, because
     * they are separate editables — so the drag is tracked and the range
     * derived from which block the pointer is over.
     */
    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (readOnly) return;
        dragAnchor.current = pathUnder(event.target);
        if (selected.length > 0) clearBlockSelection();
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        // `buttons === 1` rather than a "dragging" flag: a mouseup outside the
        // editor never reaches us, and a stale flag would make plain hovering
        // select blocks.
        if (readOnly || event.buttons !== 1 || !dragAnchor.current) return;
        const over = pathUnder(event.target);
        if (!over || pathKey(over) === pathKey(dragAnchor.current)) return;
        selectBlocks(dragAnchor.current, over);
    };

    /**
     * The selection's own keyboard handling, in **capture** so it runs before
     * the editable's — while blocks are selected, Backspace means "delete these
     * five", not "delete a character".
     */
    const handleRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const modifier = event.metaKey || event.ctrlKey;

        // Alignment, ⌘⇧L/E/R/J. Handled on the root so it works with a block
        // selection (no caret, so no editable is listening) and with one
        // block focused alike.
        if (modifier && event.shiftKey && !readOnly) {
            const align = ALIGN_SHORTCUTS[event.key.toLowerCase()];
            if (align) {
                event.preventDefault();
                if (selected.length > 0) commands.setAlignMany(selected, align);
                else if (activePath) commands.setAlign(activePath, align);
                return;
            }
        }

        // ⌘A promotes the caret's block to a whole-document selection. The
        // browser's own select-all stops at one editable, which reads as broken.
        if (modifier && event.key.toLowerCase() === 'a' && !readOnly) {
            event.preventDefault();
            selectAllBlocks();
            return;
        }
        // Undo/redo, while the **root** holds focus. Selecting blocks takes the
        // caret out of every editable, so `InlineEditable`'s own shortcut
        // handler is not listening — without this, one ⌘B across a selection
        // could not be taken back from the keyboard at all.
        if (modifier && event.key.toLowerCase() === SHORTCUT_KEY.Undo) {
            event.preventDefault();
            if (event.shiftKey) doc.redo();
            else doc.undo();
            return;
        }
        if (selected.length === 0) return;

        if (event.key === KEY.Escape) {
            event.preventDefault();
            clearBlockSelection();
            return;
        }
        if (event.key === KEY.Backspace || event.key === KEY.Delete) {
            event.preventDefault();
            commands.removeMany(selected);
            clearBlockSelection();
            return;
        }
        if (!modifier) return;

        const key = event.key.toLowerCase();
        const mark = SELECTION_MARKS[key];
        if (mark) {
            event.preventDefault();
            commands.toggleMarkMany(selected, mark);
            return;
        }
        if (key === 'c') {
            event.preventDefault();
            commands.copyMany(selected);
            return;
        }
        if (key === 'x') {
            event.preventDefault();
            commands.cutMany(selected);
            clearBlockSelection();
        }
    };

    /** Blur only counts when focus left the editor entirely, not between blocks. */
    const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setSlash(null);
        onBlur?.();
    };

    /**
     * Clicking the empty space under the last block appends a paragraph — the
     * "keep writing" gesture every document editor has. Without it, a document
     * ending in an image or a divider has no way back to text but the menu.
     */
    const handleSurfaceClick = () => {
        if (readOnly) return;
        const lastIndex = doc.blocks.length - 1;
        const last = doc.blocks[lastIndex];
        if (!last) return;
        // An empty last paragraph is already the "keep writing" line — put the
        // caret in it instead of stacking another empty one under it.
        if (
            schema.get(last.type)?.content === 'inline' &&
            last.html.trim() === ''
        ) {
            doc.requestFocus([lastIndex], CARET.End);
            return;
        }
        commands.insertAfter([lastIndex], [createBlock(PARAGRAPH_TYPE)]);
    };

    return (
        <EditorProvider value={context}>
            <div
                ref={attachRoot}
                id={id}
                // Focusable so the block selection has somewhere to put focus
                // and something to receive its keys — never a tab stop.
                tabIndex={-1}
                onKeyDownCapture={handleRootKeyDown}
                role="group"
                aria-label={intl.formatMessage(messages.label)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-readonly={readOnly || undefined}
                onBlur={handleBlur}
                className={cn(
                    'bg-background',
                    // With a toolbar the editor is the whole surface: it fills
                    // its parent and scrolls under the bar, so the bar stays.
                    toolbar
                        ? 'flex h-full min-h-0 flex-col'
                        : 'rounded-md border',
                    invalid && !toolbar && 'border-destructive',
                    readOnly && 'bg-muted/30',
                    // While blocks are selected the pointer is choosing blocks,
                    // not text; letting it also paint a text selection would
                    // show two competing highlights.
                    selected.length > 0 && 'select-none',
                    'focus:outline-none',
                    className
                )}
            >
                {toolbar && <EditorToolbar />}
                <div
                    // The pointer selects **blocks**, so it listens on the
                    // document and not on the root — the root also holds the
                    // toolbar, and a mousedown there was clearing the very
                    // selection the button was about to act on. The toolbar's
                    // whole selection-aware half was unreachable by mouse.
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    className={cn(toolbar && 'min-h-0 flex-1 overflow-y-auto')}
                >
                    {/* The left padding is the gutter's lane — the add and drag
                        controls sit in it, outside the text's own column. It is
                        also what the gutter positions itself against, so it
                        scrolls with the document rather than under it. */}
                    <div
                        ref={surfaceRef}
                        className={cn(
                            'relative py-3 pr-4 pl-14',
                            toolbar && 'mx-auto max-w-3xl px-6 py-10 pl-16',
                            // Inline marks live in the markup each editable
                            // renders verbatim, so the editor needs the same
                            // colour rules the rendered document uses.
                            ...WYSIWYG_INLINE_PROSE
                        )}
                    >
                        {!readOnly && (
                            <BlockGutter
                                blocks={doc.blocks}
                                surfaceRef={surfaceRef}
                            />
                        )}
                        <BlockList blocks={doc.blocks} />
                        {!readOnly && (
                            // Not a button: it is a click target, and announcing
                            // "append paragraph" between every document and its
                            // end would be noise. Keyboard users reach the same
                            // thing with Enter on the last block.
                            <div
                                aria-hidden
                                className={cn(
                                    'cursor-text',
                                    toolbar ? 'h-32' : 'h-8'
                                )}
                                onClick={handleSurfaceClick}
                            />
                        )}
                    </div>
                </div>
            </div>

            {slash && !readOnly && (
                <SlashMenu
                    state={slash}
                    groups={slashGroups}
                    activeId={activeItem?.id ?? null}
                    container={overlayContainer}
                    onSelect={applySlash}
                />
            )}
            {!readOnly && (
                <InlineToolbar
                    containerRef={rootRef}
                    container={overlayContainer}
                    version={toolbarVersion}
                    linkRequest={linkRequest}
                />
            )}
        </EditorProvider>
    );
}
