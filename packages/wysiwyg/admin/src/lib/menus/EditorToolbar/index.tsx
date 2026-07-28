import { useCallback, useEffect, useState } from 'react';
import type { BlockAttrs } from '@ortha-cms/wysiwyg-core';
import { defineMessages, useIntl } from 'react-intl';
import {
    Bold,
    ChevronDown,
    Code,
    Italic,
    Link as LinkIcon,
    Plus,
    Redo2,
    Strikethrough,
    Underline,
    Undo2
} from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    Separator
} from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import { INSERT_POSITION } from '../../utils/constants';
import {
    MARK,
    readMarkState,
    toggleCodeMark,
    toggleMark,
    type Mark,
    type MarkState
} from '../../utils/marks';
import { ToolbarButton } from '../ToolbarButton';
import { useBlockTypeItems } from '../useBlockTypeItems';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.editorToolbar.label',
        defaultMessage: 'Editor toolbar'
    },
    undo: { id: 'wysiwyg.editorToolbar.undo', defaultMessage: 'Undo' },
    redo: { id: 'wysiwyg.editorToolbar.redo', defaultMessage: 'Redo' },
    bold: { id: 'wysiwyg.toolbar.bold', defaultMessage: 'Bold' },
    italic: { id: 'wysiwyg.toolbar.italic', defaultMessage: 'Italic' },
    underline: {
        id: 'wysiwyg.toolbar.underline',
        defaultMessage: 'Underline'
    },
    strike: { id: 'wysiwyg.toolbar.strike', defaultMessage: 'Strikethrough' },
    code: { id: 'wysiwyg.toolbar.code', defaultMessage: 'Inline code' },
    link: { id: 'wysiwyg.toolbar.link', defaultMessage: 'Link' },
    turnInto: {
        id: 'wysiwyg.editorToolbar.turnInto',
        defaultMessage: 'Turn the current block into…'
    },
    insert: {
        id: 'wysiwyg.editorToolbar.insert',
        defaultMessage: 'Insert'
    },
    insertHint: {
        id: 'wysiwyg.editorToolbar.insertHint',
        defaultMessage: 'Insert a block below the current one'
    },
    noBlock: {
        id: 'wysiwyg.editorToolbar.noBlock',
        defaultMessage: 'Text'
    }
});

/**
 * The **persistent toolbar** above the writing surface, shown when the editor
 * has the room for one (the expanded field).
 *
 * The floating toolbar over a selection is faster once you know the editor;
 * this one is how you find out it can do any of this at all. They deliberately
 * overlap on the marks and read the same state (`readMarkState`), so they can
 * never disagree about whether the selection is bold.
 *
 * Every control acts on the **last focused block** rather than on whatever the
 * caret reports now: pressing a toolbar button is itself a focus event, and the
 * block picker's dropdown takes focus outright.
 */
export function EditorToolbar() {
    const intl = useIntl();
    const {
        commands,
        schema,
        views,
        activePath,
        activeBlockType,
        activeBlockAttrs,
        canUndo,
        canRedo,
        undo,
        redo,
        openLinkEditor,
        readOnly
    } = useEditor();
    const groups = useBlockTypeItems(schema, views);
    const [marks, setMarks] = useState<MarkState>(readMarkState);

    // The marks change with the selection *and* with a command that changes
    // them without moving it, so both are listened for.
    const refresh = useCallback(() => setMarks(readMarkState()), []);
    useEffect(() => {
        document.addEventListener('selectionchange', refresh);
        return () => document.removeEventListener('selectionchange', refresh);
    }, [refresh]);

    if (readOnly) return null;

    const runMark = (mark: Mark) => {
        toggleMark(mark);
        refresh();
    };

    // The label on the block picker — what the caret is currently sitting in.
    // Matched on the **attributes too**, because one type can be several menu
    // entries: three heading levels share `type: 'heading'`, and matching on
    // type alone labelled every heading "Heading 1". A type whose exact attrs
    // aren't on the menu (an h4, which the menu stops at 3) still falls back to
    // its type's first entry rather than to nothing.
    const items = groups.flatMap((group) => group.items);
    const current =
        items.find(
            (item) =>
                item.type === activeBlockType &&
                attrsMatch(item.attrs, activeBlockAttrs)
        ) ?? items.find((item) => item.type === activeBlockType);

    return (
        <div
            role="toolbar"
            aria-label={intl.formatMessage(messages.label)}
            // One `mousedown` guard for the whole bar: a click anywhere on it,
            // padding included, would otherwise collapse the selection it is
            // about to format.
            onMouseDown={(event) => event.preventDefault()}
            className="bg-background flex shrink-0 flex-wrap items-center gap-1 border-b px-4 py-1.5"
        >
            <ToolbarButton
                label={intl.formatMessage(messages.undo)}
                active={false}
                disabled={!canUndo}
                onClick={undo}
            >
                <Undo2 aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.redo)}
                active={false}
                disabled={!canRedo}
                onClick={redo}
            >
                <Redo2 aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!activePath}
                        aria-label={intl.formatMessage(messages.turnInto)}
                        className="h-7 gap-1 px-2 text-xs font-normal"
                    >
                        {current ? (
                            <current.Icon aria-hidden className="size-4" />
                        ) : null}
                        {current?.label ?? intl.formatMessage(messages.noBlock)}
                        <ChevronDown aria-hidden className="size-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="max-h-80 w-52 overflow-y-auto"
                >
                    {groups.map((group) => (
                        <div key={group.id}>
                            <DropdownMenuLabel className="text-muted-foreground text-xs">
                                {group.label}
                            </DropdownMenuLabel>
                            {group.items.map((item) => (
                                <DropdownMenuItem
                                    key={item.id}
                                    onSelect={() =>
                                        activePath &&
                                        commands.setType(
                                            activePath,
                                            item.type,
                                            item.attrs
                                        )
                                    }
                                >
                                    <item.Icon aria-hidden className="size-4" />
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <ToolbarButton
                label={intl.formatMessage(messages.bold)}
                active={marks.bold}
                onClick={() => runMark(MARK.Bold)}
            >
                <Bold aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.italic)}
                active={marks.italic}
                onClick={() => runMark(MARK.Italic)}
            >
                <Italic aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.underline)}
                active={marks.underline}
                onClick={() => runMark(MARK.Underline)}
            >
                <Underline aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.strike)}
                active={marks.strike}
                onClick={() => runMark(MARK.Strike)}
            >
                <Strikethrough aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.code)}
                active={marks.code}
                onClick={() => {
                    toggleCodeMark();
                    refresh();
                }}
            >
                <Code aria-hidden className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                label={intl.formatMessage(messages.link)}
                active={marks.link !== null}
                onClick={openLinkEditor}
            >
                <LinkIcon aria-hidden className="size-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!activePath}
                        title={intl.formatMessage(messages.insertHint)}
                        className="h-7 gap-1 px-2 text-xs font-normal"
                    >
                        <Plus aria-hidden className="size-4" />
                        {intl.formatMessage(messages.insert)}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="max-h-80 w-52 overflow-y-auto"
                >
                    {groups.map((group) => (
                        <div key={group.id}>
                            <DropdownMenuLabel className="text-muted-foreground text-xs">
                                {group.label}
                            </DropdownMenuLabel>
                            {group.items.map((item) => (
                                <DropdownMenuItem
                                    key={item.id}
                                    onSelect={() =>
                                        activePath &&
                                        commands.insertTypeAt(
                                            activePath,
                                            item.type,
                                            item.attrs,
                                            INSERT_POSITION.After
                                        )
                                    }
                                >
                                    <item.Icon aria-hidden className="size-4" />
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/**
 * Whether a menu entry's attributes are all present on the block — the entry
 * names a *subset* (a heading item pins `level` and says nothing about the
 * rest), so an entry with no attributes matches any block of its type.
 */
function attrsMatch(
    itemAttrs: BlockAttrs | undefined,
    blockAttrs: BlockAttrs | null
): boolean {
    if (!itemAttrs) return true;
    if (!blockAttrs) return false;
    return Object.entries(itemAttrs).every(
        ([key, value]) => blockAttrs[key] === value
    );
}
