import { useState, type DragEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2 } from 'lucide-react';
import {
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
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useEditor } from '../../editor/editorContext';
import { BLOCK_DRAG_TYPE, pathKey } from '../../utils/constants';
import { useBlockTypeItems } from '../useBlockTypeItems';

const messages = defineMessages({
    open: {
        id: 'wysiwyg.blockMenu.open',
        defaultMessage: 'Block options — drag to move'
    },
    turnInto: {
        id: 'wysiwyg.blockMenu.turnInto',
        defaultMessage: 'Turn into'
    },
    tone: {
        id: 'wysiwyg.blockMenu.tone',
        defaultMessage: 'Colour'
    },
    duplicate: {
        id: 'wysiwyg.blockMenu.duplicate',
        defaultMessage: 'Duplicate'
    },
    moveUp: {
        id: 'wysiwyg.blockMenu.moveUp',
        defaultMessage: 'Move up'
    },
    moveDown: {
        id: 'wysiwyg.blockMenu.moveDown',
        defaultMessage: 'Move down'
    },
    remove: {
        id: 'wysiwyg.blockMenu.remove',
        defaultMessage: 'Delete'
    },
    toneInfo: { id: 'wysiwyg.tone.info', defaultMessage: 'Info' },
    toneSuccess: { id: 'wysiwyg.tone.success', defaultMessage: 'Success' },
    toneWarning: { id: 'wysiwyg.tone.warning', defaultMessage: 'Warning' },
    toneDanger: { id: 'wysiwyg.tone.danger', defaultMessage: 'Danger' },
    toneNeutral: { id: 'wysiwyg.tone.neutral', defaultMessage: 'Neutral' }
});

/** Tone → its localized name. */
const TONE_MESSAGE: Record<string, keyof typeof messages> = {
    info: 'toneInfo',
    success: 'toneSuccess',
    warning: 'toneWarning',
    danger: 'toneDanger',
    neutral: 'toneNeutral'
};

/**
 * The per-block handle: **drag** it to move the block, **click** it for the
 * block's actions (turn into, duplicate, move, delete).
 *
 * One control with two gestures is what Notion-shaped editors trained everyone
 * to expect, and it keeps the gutter to two buttons instead of five. The drag
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
            <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        {intl.formatMessage(messages.turnInto)}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                        {groups.map((group) => (
                            <div key={group.id}>
                                <DropdownMenuLabel className="text-muted-foreground text-xs">
                                    {group.label}
                                </DropdownMenuLabel>
                                {group.items.map((item) => (
                                    <DropdownMenuItem
                                        key={item.id}
                                        onSelect={() =>
                                            commands.setType(
                                                path,
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
                    </DropdownMenuSubContent>
                </DropdownMenuSub>

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
                <DropdownMenuItem onSelect={() => commands.duplicate(path)}>
                    <Copy aria-hidden className="size-4" />
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
