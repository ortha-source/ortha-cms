import { useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CaseSensitive, ChevronDown } from 'lucide-react';
import {
    FONT_FAMILIES,
    FONT_FAMILY,
    TEXT_SIZE,
    TEXT_SIZES,
    TYPOGRAPHY_MARK,
    type TypographyMark
} from '@ortha-cms/wysiwyg-core';
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
import { FONT_CLASS, TEXT_SIZE_CLASS } from '../../render/wysiwygProse';

const messages = defineMessages({
    trigger: {
        id: 'wysiwyg.typography.trigger',
        defaultMessage: 'Typeface and size'
    },
    fontSection: {
        id: 'wysiwyg.typography.fontSection',
        defaultMessage: 'Typeface'
    },
    sizeSection: {
        id: 'wysiwyg.typography.sizeSection',
        defaultMessage: 'Size'
    },
    default: { id: 'wysiwyg.typography.default', defaultMessage: 'Default' },
    sans: { id: 'wysiwyg.typography.sans', defaultMessage: 'Sans serif' },
    serif: { id: 'wysiwyg.typography.serif', defaultMessage: 'Serif' },
    mono: { id: 'wysiwyg.typography.mono', defaultMessage: 'Monospace' },
    normal: { id: 'wysiwyg.typography.normal', defaultMessage: 'Normal' },
    small: { id: 'wysiwyg.typography.small', defaultMessage: 'Small' },
    large: { id: 'wysiwyg.typography.large', defaultMessage: 'Large' },
    huge: { id: 'wysiwyg.typography.huge', defaultMessage: 'Huge' }
});

/**
 * Typeface and relative size — **roles and steps, not a font menu and a point
 * picker**.
 *
 * The value ends up in HTML some other surface renders, so `serif` is something
 * any consumer can honour with its own stack where `Helvetica Neue` is a guess
 * about a machine we have never seen; `large` survives a phone where `18pt`
 * does not. Both defaults mean *no mark*, so resetting leaves the run with no
 * markup rather than with a span saying "normal".
 */
export function TypographyControl({
    font,
    size,
    onPick
}: {
    /** The typeface at the caret, or `null`. */
    font: string | null;
    /** The relative size at the caret, or `null`. */
    size: string | null;
    onPick(mark: TypographyMark, value: string | null): void;
}) {
    const intl = useIntl();
    // Same reason as the colour menu: a Radix menu takes focus and the browser
    // drops the selection with it, so the range is saved before it can.
    const savedRange = useRef<Range | null>(null);

    const remember = () => {
        const selection = window.getSelection();
        savedRange.current =
            selection && selection.rangeCount > 0 && !selection.isCollapsed
                ? selection.getRangeAt(0).cloneRange()
                : null;
    };

    const pick = (mark: TypographyMark, value: string | null) => {
        const range = savedRange.current;
        const selection = window.getSelection();
        if (range && selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
        onPick(mark, value);
    };

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
                            className="h-7 gap-1 px-2"
                            onPointerDown={remember}
                            onKeyDown={remember}
                        >
                            <CaseSensitive aria-hidden className="size-4" />
                            <ChevronDown aria-hidden className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {intl.formatMessage(messages.trigger)}
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.fontSection)}
                </DropdownMenuLabel>
                {FONT_FAMILIES.map((name) => (
                    <DropdownMenuItem
                        key={`font-${name}`}
                        className={FONT_CLASS[name]}
                        onSelect={() =>
                            pick(
                                TYPOGRAPHY_MARK.Font,
                                name === FONT_FAMILY.Default ? null : name
                            )
                        }
                    >
                        {intl.formatMessage(messages[name])}
                        {font === name ? ' ✓' : ''}
                    </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.sizeSection)}
                </DropdownMenuLabel>
                {TEXT_SIZES.map((name) => (
                    <DropdownMenuItem
                        key={`size-${name}`}
                        className={TEXT_SIZE_CLASS[name]}
                        onSelect={() =>
                            pick(
                                TYPOGRAPHY_MARK.Size,
                                name === TEXT_SIZE.Normal ? null : name
                            )
                        }
                    >
                        {intl.formatMessage(messages[name])}
                        {size === name ? ' ✓' : ''}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
