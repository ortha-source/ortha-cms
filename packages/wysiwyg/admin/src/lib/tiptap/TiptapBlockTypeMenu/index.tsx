import { defineMessages, useIntl } from 'react-intl';
import { useEditorState } from '@tiptap/react';
import { ChevronDown } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@ortha-cms/design-system';
import { BLOCK_TYPES } from '../blockTypes';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    trigger: {
        id: 'wysiwyg.toolbar.turnInto',
        defaultMessage: 'Turn the current block into…'
    }
});

/**
 * The toolbar's block-type picker, naming the block the caret is in.
 *
 * It names the *exact* block, not just its type: six heading levels share one
 * node type, and matching on the type alone labelled every heading "Heading 1".
 * Each catalogue entry answers `isActive` for itself, so the label is whatever
 * the entry that claims the caret is called.
 */
export function TiptapBlockTypeMenu() {
    const intl = useIntl();
    const { editor } = useWysiwyg();

    const activeId = useEditorState({
        editor,
        selector: ({ editor: instance }) =>
            instance
                ? (BLOCK_TYPES.find((item) => item.isActive(instance))?.id ??
                  null)
                : null
    });

    if (!editor) return null;
    const active =
        BLOCK_TYPES.find((item) => item.id === activeId) ?? BLOCK_TYPES[0];

    return (
        <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={intl.formatMessage(messages.trigger)}
                            className="h-7 gap-1 px-2 text-xs font-normal"
                        >
                            <active.Icon aria-hidden className="size-3.5" />
                            {intl.formatMessage(active.label)}
                            <ChevronDown aria-hidden className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {intl.formatMessage(messages.trigger)}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-56">
                {BLOCK_TYPES.map((item) => (
                    <DropdownMenuItem
                        key={item.id}
                        onSelect={() => item.apply(editor)}
                    >
                        <item.Icon aria-hidden className="size-4" />
                        {intl.formatMessage(item.label)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
