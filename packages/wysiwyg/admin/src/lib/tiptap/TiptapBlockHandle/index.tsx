import { useCallback, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
    ArrowDownToLine,
    ArrowUpToLine,
    Copy,
    GripVertical,
    Plus,
    Trash2
} from 'lucide-react';
import {
    BLOCK_ALIGN,
    BLOCK_ALIGNS,
    type BlockAlign
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
import { BLOCK_TYPES } from '../blockTypes';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    add: { id: 'wysiwyg.gutter.insert', defaultMessage: 'Add a block below' },
    open: { id: 'wysiwyg.gutter.menu', defaultMessage: 'Block options' },
    turnInto: { id: 'wysiwyg.menu.turnInto', defaultMessage: 'Turn into' },
    align: { id: 'wysiwyg.menu.align', defaultMessage: 'Align' },
    alignLeft: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    alignCenter: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    alignRight: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' },
    alignJustify: { id: 'wysiwyg.align.justify', defaultMessage: 'Justify' },
    duplicate: { id: 'wysiwyg.menu.duplicate', defaultMessage: 'Duplicate' },
    moveUp: { id: 'wysiwyg.menu.moveUp', defaultMessage: 'Move up' },
    moveDown: { id: 'wysiwyg.menu.moveDown', defaultMessage: 'Move down' },
    remove: { id: 'wysiwyg.menu.delete', defaultMessage: 'Delete' }
});

const ALIGN_MESSAGE = {
    [BLOCK_ALIGN.Left]: 'alignLeft',
    [BLOCK_ALIGN.Center]: 'alignCenter',
    [BLOCK_ALIGN.Right]: 'alignRight',
    [BLOCK_ALIGN.Justify]: 'alignJustify'
} as const;

/**
 * The controls on a block's own line — add, drag, and the block menu.
 *
 * The travelling behaviour is TipTap's `DragHandle` now, and that is the whole
 * reason to use it: the old gutter was a single element positioned by hand,
 * which meant owning "which block is the pointer over", "where is its first
 * line", and a reach corridor so the controls did not flee when an author
 * moved towards them. All three were bugs before they were features. The
 * extension resolves the node under the pointer and does the dragging; what is
 * left here is what the buttons *do*.
 */
export function TiptapBlockHandle() {
    const intl = useIntl();
    const { editor, readOnly } = useWysiwyg();
    /** The block the handle is parked on, so the menu can act on it. */
    const [node, setNode] = useState<{
        node: ProseMirrorNode | null;
        pos: number;
    }>({ node: null, pos: -1 });

    /**
     * Stable, and that is load-bearing rather than a micro-optimisation.
     * `DragHandle` lists this handler in the deps of the effect that registers
     * its ProseMirror plugin, and the plugin hides the handle on registration —
     * so an inline arrow makes the sequence "show the handle → tell React which
     * node it is on → re-register → hide the handle", and the controls never
     * appear at all. Re-registering also destroys every *other* plugin's view,
     * which is what was closing the `/` palette one render after it opened.
     */
    const onNodeChange = useCallback(
        ({
            node: current,
            pos
        }: {
            node: ProseMirrorNode | null;
            pos: number;
        }) => setNode({ node: current, pos }),
        []
    );

    if (!editor || readOnly) return null;

    /** Puts the selection on the parked block, so a command lands on it. */
    const onBlock = () =>
        node.pos >= 0
            ? editor.chain().focus().setNodeSelection(node.pos)
            : editor.chain().focus();

    return (
        <DragHandle editor={editor} onNodeChange={onNodeChange}>
            <div className="flex items-center gap-0.5 pr-1">
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={intl.formatMessage(messages.add)}
                    className="text-muted-foreground size-6"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .insertContentAt(
                                node.pos + (node.node?.nodeSize ?? 0),
                                { type: 'paragraph' }
                            )
                            .run()
                    }
                >
                    <Plus aria-hidden className="size-4" />
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={intl.formatMessage(messages.open)}
                            className="text-muted-foreground size-6 cursor-grab"
                        >
                            <GripVertical aria-hidden className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                {intl.formatMessage(messages.turnInto)}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                                {BLOCK_TYPES.map((item) => (
                                    <DropdownMenuItem
                                        key={item.id}
                                        onSelect={() => {
                                            onBlock().run();
                                            item.apply(editor);
                                        }}
                                    >
                                        <item.Icon
                                            aria-hidden
                                            className="size-4"
                                        />
                                        {intl.formatMessage(item.label)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                {intl.formatMessage(messages.align)}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                {BLOCK_ALIGNS.map((align: BlockAlign) => (
                                    <DropdownMenuItem
                                        key={align}
                                        onSelect={() =>
                                            onBlock().setBlockAlign(align).run()
                                        }
                                    >
                                        {intl.formatMessage(
                                            messages[ALIGN_MESSAGE[align]]
                                        )}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() => {
                                if (!node.node || node.pos < 0) return;
                                editor
                                    .chain()
                                    .focus()
                                    .insertContentAt(
                                        node.pos + node.node.nodeSize,
                                        node.node.toJSON()
                                    )
                                    .run();
                            }}
                        >
                            <Copy aria-hidden className="size-4" />
                            {intl.formatMessage(messages.duplicate)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => onBlock().lift('paragraph').run()}
                        >
                            <ArrowUpToLine aria-hidden className="size-4" />
                            {intl.formatMessage(messages.moveUp)}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => onBlock().joinDown().run()}
                        >
                            <ArrowDownToLine aria-hidden className="size-4" />
                            {intl.formatMessage(messages.moveDown)}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => onBlock().deleteSelection().run()}
                        >
                            <Trash2 aria-hidden className="size-4" />
                            {intl.formatMessage(messages.remove)}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </DragHandle>
    );
}
