import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@ortha-cms/design-system';
import { BLOCK_GROUP } from '@ortha-cms/wysiwyg-core';
import { BLOCK_TYPES } from '../blockTypes';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    trigger: { id: 'wysiwyg.toolbar.insert', defaultMessage: 'Insert' },
    basic: { id: 'wysiwyg.group.basic', defaultMessage: 'Basic' },
    media: { id: 'wysiwyg.group.media', defaultMessage: 'Media' },
    advanced: { id: 'wysiwyg.group.advanced', defaultMessage: 'Advanced' }
});

/** The sections, in menu order. */
const GROUPS = [
    { group: BLOCK_GROUP.Basic, label: messages.basic },
    { group: BLOCK_GROUP.Media, label: messages.media },
    { group: BLOCK_GROUP.Advanced, label: messages.advanced }
];

/**
 * The toolbar's Insert menu — the same catalogue the slash palette offers, for
 * an author who has not learned that `/` opens it.
 *
 * Discoverability is the whole job. The slash menu is faster once you know the
 * editor can do any of this; this is how you find out.
 */
export function TiptapInsertMenu() {
    const intl = useIntl();
    const { editor } = useWysiwyg();
    if (!editor) return null;

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
                            <Plus aria-hidden className="size-3.5" />
                            {intl.formatMessage(messages.trigger)}
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {intl.formatMessage(messages.trigger)}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-56">
                {GROUPS.map(({ group, label }, index) => {
                    const items = BLOCK_TYPES.filter(
                        (item) => item.group === group
                    );
                    if (items.length === 0) return null;
                    return (
                        <div key={group}>
                            {index > 0 && <DropdownMenuSeparator />}
                            <DropdownMenuLabel className="text-muted-foreground text-xs">
                                {intl.formatMessage(label)}
                            </DropdownMenuLabel>
                            {items.map((item) => (
                                <DropdownMenuItem
                                    key={item.id}
                                    onSelect={() => item.apply(editor)}
                                >
                                    <item.Icon aria-hidden className="size-4" />
                                    {intl.formatMessage(item.label)}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
