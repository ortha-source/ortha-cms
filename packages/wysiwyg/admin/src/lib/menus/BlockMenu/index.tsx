import { useState, type DragEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    ArrowDownToLine,
    ArrowUpToLine,
    ChevronDown,
    ChevronUp,
    ClipboardPaste,
    Copy,
    GripVertical,
    Scissors,
    Trash2
} from 'lucide-react';
import {
    BLOCK_ALIGN,
    BLOCK_ALIGNS,
    BLOCK_TYPE,
    CALLOUT_TONES,
    type BlockPath,
    type WysiwygBlock
} from '@ortha-cms/wysiwyg-core';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useBlockClipboard } from '../../blocks/blockClipboard';
import { useEditor } from '../../editor/editorContext';
import {
    BLOCK_DRAG_TYPE,
    INSERT_POSITION,
    pathKey
} from '../../utils/constants';
import { useBlockTypeItems } from '../useBlockTypeItems';
import { BlockTypeSubmenu } from './BlockTypeSubmenu';

const messages = defineMessages({
    open: {
        id: 'wysiwyg.blockMenu.open',
        defaultMessage: 'Block options — drag to move'
    },
    align: {
        id: 'wysiwyg.blockMenu.align',
        defaultMessage: 'Align'
    },
    alignLeft: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    alignCenter: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    alignRight: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' },
    alignJustify: { id: 'wysiwyg.align.justify', defaultMessage: 'Justify' },
    turnInto: {
        id: 'wysiwyg.blockMenu.turnInto',
        defaultMessage: 'Turn into'
    },
    insertAbove: {
        id: 'wysiwyg.blockMenu.insertAbove',
        defaultMessage: 'Insert above'
    },
    insertBelow: {
        id: 'wysiwyg.blockMenu.insertBelow',
        defaultMessage: 'Insert below'
    },
    tone: {
        id: 'wysiwyg.blockMenu.tone',
        defaultMessage: 'Colour'
    },
    copy: { id: 'wysiwyg.blockMenu.copy', defaultMessage: 'Copy' },
    cut: { id: 'wysiwyg.blockMenu.cut', defaultMessage: 'Cut' },
    pasteAbove: {
        id: 'wysiwyg.blockMenu.pasteAbove',
        defaultMessage: 'Paste above'
    },
    pasteBelow: {
        id: 'wysiwyg.blockMenu.pasteBelow',
        defaultMessage: 'Paste below'
    },
    duplicate: {
        id: 'wysiwyg.blockMenu.duplicate',
        defaultMessage: 'Duplicate'
    },
    moveUp: { id: 'wysiwyg.blockMenu.moveUp', defaultMessage: 'Move up' },
    moveDown: {
        id: 'wysiwyg.blockMenu.moveDown',
        defaultMessage: 'Move down'
    },
    remove: { id: 'wysiwyg.blockMenu.remove', defaultMessage: 'Delete' },
    toneInfo: { id: 'wysiwyg.tone.info', defaultMessage: 'Info' },
    toneSuccess: { id: 'wysiwyg.tone.success', defaultMessage: 'Success' },
    toneWarning: { id: 'wysiwyg.tone.warning', defaultMessage: 'Warning' },
    toneDanger: { id: 'wysiwyg.tone.danger', defaultMessage: 'Danger' },
    toneNeutral: { id: 'wysiwyg.tone.neutral', defaultMessage: 'Neutral' }
});

/** Tone → its localized name. */
/** The label each alignment reads as in the submenu. */
const ALIGN_MESSAGE: Record<string, keyof typeof messages> = {
    [BLOCK_ALIGN.Left]: 'alignLeft',
    [BLOCK_ALIGN.Center]: 'alignCenter',
    [BLOCK_ALIGN.Right]: 'alignRight',
    [BLOCK_ALIGN.Justify]: 'alignJustify'
};

const TONE_MESSAGE: Record<string, keyof typeof messages> = {
    info: 'toneInfo',
    success: 'toneSuccess',
    warning: 'toneWarning',
    danger: 'toneDanger',
    neutral: 'toneNeutral'
};

/**
 * The per-block handle that sits **on the block's own line**: **drag** it to
 * move the block, **click** it for everything you can do to that block —
 * change its type, insert a new one either side of it, copy/cut/paste it,
 * duplicate, move, delete.
 *
 * One control with two gestures is what Notion-shaped editors trained everyone
 * to expect, and it keeps the gutter to two buttons instead of eight. The drag
 * payload is the block's path, which is all `commands.move` needs.
 */
export function BlockMenu({
    block,
    path
}: {
    block: WysiwygBlock;
    path: BlockPath;
}) {
    const intl = useIntl();
    const { commands, schema, views } = useEditor();
    const groups = useBlockTypeItems(schema, views);
    const clipboard = useBlockClipboard();
    const [open, setOpen] = useState(false);

    const handleDragStart = (event: DragEvent<HTMLButtonElement>) => {
        event.dataTransfer.setData(BLOCK_DRAG_TYPE, pathKey(path));
        event.dataTransfer.effectAllowed = 'move';
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    draggable
                    onDragStart={handleDragStart}
                    aria-label={intl.formatMessage(messages.open)}
                    className="text-muted-foreground size-6 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical aria-hidden className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <BlockTypeSubmenu
                    label={intl.formatMessage(messages.turnInto)}
                    groups={groups}
                    onSelect={(type, attrs) =>
                        commands.setType(path, type, attrs)
                    }
                />

                {/* The only route to alignment when the editor has no
                    persistent toolbar — an inline field never shows one. */}
                {schema.get(block.type)?.aligns && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            {intl.formatMessage(messages.align)}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {BLOCK_ALIGNS.map((align) => (
                                <DropdownMenuItem
                                    key={align}
                                    onSelect={() =>
                                        commands.setAlign(path, align)
                                    }
                                >
                                    {intl.formatMessage(
                                        messages[ALIGN_MESSAGE[align]]
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                {block.type === BLOCK_TYPE.Callout && (
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            {intl.formatMessage(messages.tone)}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                            {CALLOUT_TONES.map((tone) => (
                                <DropdownMenuItem
                                    key={tone}
                                    onSelect={() =>
                                        commands.setAttrs(path, { tone })
                                    }
                                >
                                    {intl.formatMessage(
                                        messages[TONE_MESSAGE[tone]]
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                )}

                <DropdownMenuSeparator />
                <BlockTypeSubmenu
                    label={intl.formatMessage(messages.insertAbove)}
                    groups={groups}
                    onSelect={(type, attrs) =>
                        commands.insertTypeAt(
                            path,
                            type,
                            attrs,
                            INSERT_POSITION.Before
                        )
                    }
                />
                <BlockTypeSubmenu
                    label={intl.formatMessage(messages.insertBelow)}
                    groups={groups}
                    onSelect={(type, attrs) =>
                        commands.insertTypeAt(
                            path,
                            type,
                            attrs,
                            INSERT_POSITION.After
                        )
                    }
                />

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => commands.copyBlock(path)}>
                    <Copy aria-hidden className="size-4" />
                    {intl.formatMessage(messages.copy)}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => commands.cutBlock(path)}>
                    <Scissors aria-hidden className="size-4" />
                    {intl.formatMessage(messages.cut)}
                </DropdownMenuItem>
                {/* Paste is offered only when there is something to paste —
                    a permanently-disabled row teaches nothing. */}
                {clipboard && (
                    <>
                        <DropdownMenuItem
                            onSelect={() =>
                                commands.pasteBlocks(
                                    path,
                                    INSERT_POSITION.Before
                                )
                            }
                        >
                            <ArrowUpToLine aria-hidden className="size-4" />
                            {intl.formatMessage(messages.pasteAbove)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() =>
                                commands.pasteBlocks(
                                    path,
                                    INSERT_POSITION.After
                                )
                            }
                        >
                            <ArrowDownToLine aria-hidden className="size-4" />
                            {intl.formatMessage(messages.pasteBelow)}
                        </DropdownMenuItem>
                    </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => commands.duplicate(path)}>
                    <ClipboardPaste aria-hidden className="size-4" />
                    {intl.formatMessage(messages.duplicate)}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => commands.moveBy(path, -1)}>
                    <ChevronUp aria-hidden className="size-4" />
                    {intl.formatMessage(messages.moveUp)}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => commands.moveBy(path, 1)}>
                    <ChevronDown aria-hidden className="size-4" />
                    {intl.formatMessage(messages.moveDown)}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => commands.remove(path)}
                >
                    <Trash2 aria-hidden className="size-4" />
                    {intl.formatMessage(messages.remove)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
