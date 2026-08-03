import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Link as LinkIcon } from 'lucide-react';
import {
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    cn
} from '@ortha-cms/design-system';
import { KEY } from '../../utils/constants';

const messages = defineMessages({
    trigger: { id: 'wysiwyg.toolbar.link', defaultMessage: 'Link' },
    url: { id: 'wysiwyg.link.url', defaultMessage: 'Link URL' },
    placeholder: {
        id: 'wysiwyg.link.placeholder',
        defaultMessage: 'https://…'
    },
    apply: { id: 'wysiwyg.link.apply', defaultMessage: 'Apply' },
    remove: { id: 'wysiwyg.link.remove', defaultMessage: 'Remove link' }
});

/**
 * The link control in the **persistent** toolbar — a URL field in a popover
 * hanging off its own button.
 *
 * The floating selection toolbar has its own link field, and this is
 * deliberately not that one. Pressing a button in the top bar and having a
 * field appear over the text three inches below it reads as something else
 * happening, not as that button opening; every other control up here (the block
 * picker, Insert, the colour palette) opens where it was pressed, and the link
 * should too.
 *
 * Like the colour menu it saves the selection before the popover can take
 * focus: a Radix overlay moves focus into itself, and the browser drops the
 * document selection when it goes — leaving nothing to attach a link to.
 */
export function LinkControl({
    href,
    onApply,
    onRemove
}: {
    /** The `href` under the caret, or `null` when there is no link. */
    href: string | null;
    onApply(url: string, restore: () => void): void;
    onRemove(restore: () => void): void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    /**
     * Whether there **was** a link when the popover opened.
     *
     * Not read live from `href`: opening the popover moves focus into it, the
     * selection goes, and the toolbar's next `selectionchange` read reports no
     * link at all — so a Remove button driven by the prop unmounted itself the
     * instant it became reachable.
     */
    const [hadLink, setHadLink] = useState(false);
    const savedRange = useRef<Range | null>(null);

    const remember = () => {
        const selection = window.getSelection();
        savedRange.current =
            selection && selection.rangeCount > 0
                ? selection.getRangeAt(0).cloneRange()
                : null;
    };

    /** Puts the caret back where it was before the popover took focus. */
    const restore = () => {
        const range = savedRange.current;
        const selection = window.getSelection();
        if (!range || !selection) return;
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const apply = () => {
        const url = draft.trim();
        if (url) onApply(url, restore);
        setOpen(false);
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                // Seed the field from whatever link is already there, so
                // re-pointing one is an edit rather than a re-type.
                if (next) {
                    setDraft(href ?? '');
                    setHadLink(href !== null);
                }
                setOpen(next);
            }}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={intl.formatMessage(messages.trigger)}
                    aria-pressed={href !== null}
                    className={cn(
                        'size-7',
                        href !== null && 'bg-accent text-accent-foreground'
                    )}
                    onPointerDown={remember}
                    onKeyDown={remember}
                >
                    <LinkIcon aria-hidden className="size-4" />
                </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {intl.formatMessage(messages.trigger)}
                </TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-72 p-2">
                <div className="flex items-center gap-2">
                    <Input
                        autoFocus
                        value={draft}
                        aria-label={intl.formatMessage(messages.url)}
                        placeholder={intl.formatMessage(messages.placeholder)}
                        className="h-8"
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === KEY.Enter) {
                                event.preventDefault();
                                apply();
                            }
                            // Escape belongs to the popover, not to the editor
                            // behind it — otherwise one press closes the whole
                            // writing surface.
                            if (event.key === KEY.Escape) {
                                event.preventDefault();
                                setOpen(false);
                            }
                        }}
                    />
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={draft.trim() === ''}
                        onClick={apply}
                    >
                        {intl.formatMessage(messages.apply)}
                    </Button>
                </div>
                {hadLink && (
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive mt-1 h-7 w-full justify-start px-2 text-xs"
                        onClick={() => {
                            onRemove(restore);
                            setOpen(false);
                        }}
                    >
                        {intl.formatMessage(messages.remove)}
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
}
