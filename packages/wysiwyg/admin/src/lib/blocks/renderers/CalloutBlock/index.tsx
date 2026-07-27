import { defineMessages, useIntl } from 'react-intl';
import { CALLOUT_TONE } from '@ortha-cms/wysiwyg-core';
import { cn } from '@ortha-cms/design-system';
import { InlineEditable } from '../../InlineEditable';
import type { BlockViewProps } from '../../blockRegistry';

const messages = defineMessages({
    label: {
        id: 'wysiwyg.block.callout.label',
        defaultMessage: 'Callout'
    },
    placeholder: {
        id: 'wysiwyg.block.callout.placeholder',
        defaultMessage: 'Write a note…'
    }
});

/**
 * Tone → surface. Each tone is a border/background pair from the design
 * system's semantic palette, so a callout looks right in both themes without
 * the block choosing colours of its own.
 */
const TONE_CLASS: Record<string, string> = {
    [CALLOUT_TONE.Info]: 'border-primary/30 bg-primary/5',
    [CALLOUT_TONE.Success]: 'border-emerald-500/30 bg-emerald-500/5',
    [CALLOUT_TONE.Warning]: 'border-amber-500/30 bg-amber-500/5',
    [CALLOUT_TONE.Danger]: 'border-destructive/30 bg-destructive/5',
    [CALLOUT_TONE.Neutral]: 'border-border bg-muted/40'
};

/** A highlighted aside with a tone and a leading emoji. */
export function CalloutBlock({ block, path }: BlockViewProps) {
    const intl = useIntl();
    const tone = String(block.attrs['tone'] ?? CALLOUT_TONE.Info);
    const emoji = String(block.attrs['emoji'] ?? '');

    return (
        <div
            className={cn(
                'my-1 flex items-start gap-3 rounded-md border px-3 py-2',
                TONE_CLASS[tone] ?? TONE_CLASS[CALLOUT_TONE.Info]
            )}
        >
            {emoji && (
                <span aria-hidden className="mt-1 shrink-0 text-lg leading-6">
                    {emoji}
                </span>
            )}
            <InlineEditable
                path={path}
                html={block.html}
                placeholder={intl.formatMessage(messages.placeholder)}
                ariaLabel={intl.formatMessage(messages.label)}
                className="flex-1 py-0.5 leading-7"
            />
        </div>
    );
}
