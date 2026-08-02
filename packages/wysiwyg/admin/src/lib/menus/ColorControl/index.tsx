import { useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Baseline, ChevronDown } from 'lucide-react';
import {
    COLOR_MARK,
    INLINE_COLOR,
    INLINE_COLORS,
    type ColorMark
} from '@ortha-cms/wysiwyg-core';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    cn
} from '@ortha-cms/design-system';
import { COLOR_SWATCH, HIGHLIGHT_SWATCH } from '../../render/wysiwygProse';

const messages = defineMessages({
    trigger: {
        id: 'wysiwyg.color.trigger',
        defaultMessage: 'Text colour and highlight'
    },
    textSection: {
        id: 'wysiwyg.color.textSection',
        defaultMessage: 'Text'
    },
    highlightSection: {
        id: 'wysiwyg.color.highlightSection',
        defaultMessage: 'Highlight'
    },
    default: { id: 'wysiwyg.color.default', defaultMessage: 'Default' },
    gray: { id: 'wysiwyg.color.gray', defaultMessage: 'Gray' },
    brown: { id: 'wysiwyg.color.brown', defaultMessage: 'Brown' },
    orange: { id: 'wysiwyg.color.orange', defaultMessage: 'Orange' },
    yellow: { id: 'wysiwyg.color.yellow', defaultMessage: 'Yellow' },
    green: { id: 'wysiwyg.color.green', defaultMessage: 'Green' },
    blue: { id: 'wysiwyg.color.blue', defaultMessage: 'Blue' },
    purple: { id: 'wysiwyg.color.purple', defaultMessage: 'Purple' },
    pink: { id: 'wysiwyg.color.pink', defaultMessage: 'Pink' },
    red: { id: 'wysiwyg.color.red', defaultMessage: 'Red' }
});

/**
 * The colour picker — text colour over highlight, one palette each.
 *
 * A **named palette, not a colour wheel**: the value ends up in stored HTML
 * that some other surface has to render, and a hex someone picked on a Tuesday
 * is a decision about a design system this editor cannot see. Ten names it can
 * map are worth more than sixteen million it can't.
 */
export function ColorControl({
    color,
    highlight,
    onPick
}: {
    /** The palette colour at the caret, or `null`. */
    color: string | null;
    /** The highlight at the caret, or `null`. */
    highlight: string | null;
    onPick(mark: ColorMark, color: string | null): void;
}) {
    const intl = useIntl();
    const active = color ?? highlight;
    /**
     * The selection as it was when the menu opened.
     *
     * A dropdown is not a toolbar button: Radix moves focus into the menu, and
     * the browser collapses the document selection when it goes. By the time an
     * item is chosen there is nothing left to colour — so the range is taken
     * before the menu can take focus, and put back before the mark is applied.
     */
    const savedRange = useRef<Range | null>(null);

    const remember = () => {
        const selection = window.getSelection();
        savedRange.current =
            selection && selection.rangeCount > 0 && !selection.isCollapsed
                ? selection.getRangeAt(0).cloneRange()
                : null;
    };

    const pick = (mark: ColorMark, name: string | null) => {
        const range = savedRange.current;
        const selection = window.getSelection();
        if (range && selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
        onPick(mark, name);
    };

    return (
        <DropdownMenu>
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
                    <Baseline
                        aria-hidden
                        className={cn(
                            'size-4',
                            active && COLOR_SWATCH[active]
                        )}
                    />
                    <ChevronDown aria-hidden className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="max-h-80 w-44 overflow-y-auto"
            >
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.textSection)}
                </DropdownMenuLabel>
                {INLINE_COLORS.map((name) => (
                    <DropdownMenuItem
                        key={`text-${name}`}
                        onSelect={() =>
                            pick(
                                COLOR_MARK.Text,
                                name === INLINE_COLOR.Default ? null : name
                            )
                        }
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'border-border grid size-4 shrink-0 place-items-center rounded border text-[11px] font-semibold',
                                COLOR_SWATCH[name]
                            )}
                        >
                            A
                        </span>
                        {intl.formatMessage(messages[name])}
                        {color === name ? ' ✓' : ''}
                    </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.highlightSection)}
                </DropdownMenuLabel>
                {INLINE_COLORS.map((name) => (
                    <DropdownMenuItem
                        key={`highlight-${name}`}
                        onSelect={() =>
                            pick(
                                COLOR_MARK.Highlight,
                                name === INLINE_COLOR.Default ? null : name
                            )
                        }
                    >
                        <span
                            aria-hidden
                            className={cn(
                                'border-border size-4 shrink-0 rounded border',
                                HIGHLIGHT_SWATCH[name]
                            )}
                        />
                        {intl.formatMessage(messages[name])}
                        {highlight === name ? ' ✓' : ''}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
