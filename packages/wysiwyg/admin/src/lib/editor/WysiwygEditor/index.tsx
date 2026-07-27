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
    DEFAULT_BLOCK_SCHEMA,
    PARAGRAPH_TYPE,
    createBlock,
    extendBlockSchema,
    type BlockDefinition,
    type BlockSchema
} from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { BlockList } from '../../blocks/BlockList';
import { DEFAULT_BLOCK_VIEWS } from '../../blocks/defaultBlockViews';
import type { BlockViewRegistry } from '../../blocks/blockRegistry';
import { InlineToolbar } from '../../menus/InlineToolbar';
import { SlashMenu } from '../../menus/SlashMenu';
import {
    filterBlockTypeGroups,
    flattenBlockTypeGroups,
    useBlockTypeItems,
    type BlockTypeItem
} from '../../menus/useBlockTypeItems';
import { CARET, KEY } from '../../utils/constants';
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
    id,
    className,
    'aria-describedby': describedBy
}: WysiwygEditorProps) {
    const intl = useIntl();
    const rootRef = useRef<HTMLDivElement>(null);
    const editables = useRef(new Map<string, HTMLElement>());

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

    const context = useMemo(
        () => ({
            schema,
            views,
            commands,
            readOnly,
            focusRequest: doc.focusRequest,
            setSlash: openSlash,
            handleOverlayKey,
            refreshToolbar: () => setToolbarVersion((version) => version + 1),
            openLinkEditor: () => setLinkRequest((request) => request + 1),
            registerEditable,
            editableFor: (key: string) => editables.current.get(key) ?? null,
            undo: doc.undo,
            redo: doc.redo
        }),
        [
            commands,
            doc.focusRequest,
            doc.redo,
            doc.undo,
            handleOverlayKey,
            openSlash,
            readOnly,
            registerEditable,
            schema,
            views
        ]
    );

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
                ref={rootRef}
                id={id}
                role="group"
                aria-label={intl.formatMessage(messages.label)}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-readonly={readOnly || undefined}
                onBlur={handleBlur}
                className={cn(
                    'bg-background rounded-md border',
                    invalid && 'border-destructive',
                    readOnly && 'bg-muted/30',
                    className
                )}
            >
                {/* The left padding is the gutter's lane — the add and drag
                    controls sit in it, outside the text's own column. */}
                <div className="py-3 pr-4 pl-14">
                    <BlockList blocks={doc.blocks} />
                    {!readOnly && (
                        // Not a button: it is a click target, and announcing
                        // "append paragraph" between every document and its
                        // end would be noise. Keyboard users reach the same
                        // thing with Enter on the last block.
                        <div
                            aria-hidden
                            className="h-8 cursor-text"
                            onClick={handleSurfaceClick}
                        />
                    )}
                </div>
            </div>

            {slash && !readOnly && (
                <SlashMenu
                    state={slash}
                    groups={slashGroups}
                    activeId={activeItem?.id ?? null}
                    onSelect={applySlash}
                />
            )}
            {!readOnly && (
                <InlineToolbar
                    containerRef={rootRef}
                    version={toolbarVersion}
                    linkRequest={linkRequest}
                />
            )}
        </EditorProvider>
    );
}
