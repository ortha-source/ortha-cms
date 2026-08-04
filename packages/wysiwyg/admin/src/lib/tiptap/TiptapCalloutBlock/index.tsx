import { defineMessages, useIntl } from 'react-intl';
import {
    NodeViewContent,
    NodeViewWrapper,
    type NodeViewProps
} from '@tiptap/react';
import {
    CALLOUT_TONE,
    CALLOUT_TONES,
    type CalloutTone
} from '@ortha-cms/wysiwyg-core';
import { Input, cn } from '@ortha-cms/design-system';
import { useWysiwyg } from '../tiptapContext';

const messages = defineMessages({
    emoji: { id: 'wysiwyg.block.callout.emoji', defaultMessage: 'Callout icon' },
    tone: { id: 'wysiwyg.block.callout.tone', defaultMessage: 'Callout tone' },
    info: { id: 'wysiwyg.block.callout.info', defaultMessage: 'Info' },
    success: { id: 'wysiwyg.block.callout.success', defaultMessage: 'Success' },
    warning: { id: 'wysiwyg.block.callout.warning', defaultMessage: 'Warning' },
    danger: { id: 'wysiwyg.block.callout.danger', defaultMessage: 'Danger' },
    neutral: { id: 'wysiwyg.block.callout.neutral', defaultMessage: 'Neutral' }
});

const TONE_MESSAGE = {
    [CALLOUT_TONE.Info]: 'info',
    [CALLOUT_TONE.Success]: 'success',
    [CALLOUT_TONE.Warning]: 'warning',
    [CALLOUT_TONE.Danger]: 'danger',
    [CALLOUT_TONE.Neutral]: 'neutral'
} as const;

/** How each tone reads in the picker — the mirror of the prose rules. */
const TONE_SWATCH = {
    [CALLOUT_TONE.Info]: 'bg-primary/40',
    [CALLOUT_TONE.Success]: 'bg-emerald-500/40',
    [CALLOUT_TONE.Warning]: 'bg-amber-500/40',
    [CALLOUT_TONE.Danger]: 'bg-destructive/40',
    [CALLOUT_TONE.Neutral]: 'bg-muted-foreground/40'
} as const;

/**
 * A callout — an aside with a tone and an icon.
 *
 * The tone is a **name**, not a colour: the stored value is HTML a delivery
 * surface styles for itself, and `warning` is something it can map onto its own
 * palette where `#f59e0b` is one designer's decision baked into content. The
 * five names are the sanitizer's vocabulary, so a sixth cannot be smuggled in.
 *
 * The picker is chrome and sits inside the aside, `contentEditable={false}`, so
 * the callout's body stays one ordinary block container — a caret, Enter, the
 * slash menu, all of it inherited rather than reimplemented.
 */
export function TiptapCalloutBlock({ node, updateAttributes }: NodeViewProps) {
    const intl = useIntl();
    const { readOnly } = useWysiwyg();
    const tone = String(node.attrs['tone'] ?? CALLOUT_TONE.Info);
    const emoji = String(node.attrs['emoji'] ?? '');

    return (
        <NodeViewWrapper
            as="aside"
            data-block="callout"
            data-tone={tone}
            data-emoji={emoji || undefined}
            className="group/callout relative"
        >
            {!readOnly && (
                <div
                    contentEditable={false}
                    className="absolute top-1 right-1 flex items-center gap-1 opacity-0 transition-opacity group-focus-within/callout:opacity-100 group-hover/callout:opacity-100"
                >
                    <Input
                        value={emoji}
                        maxLength={2}
                        aria-label={intl.formatMessage(messages.emoji)}
                        className="h-6 w-10 border-dashed bg-transparent px-1 text-center text-xs shadow-none"
                        onChange={(event) =>
                            updateAttributes({ emoji: event.target.value })
                        }
                    />
                    {CALLOUT_TONES.map((name) => (
                        <button
                            key={name}
                            type="button"
                            aria-label={intl.formatMessage(
                                messages[TONE_MESSAGE[name as CalloutTone]]
                            )}
                            aria-pressed={tone === name}
                            className={cn(
                                'border-border size-4 rounded-full border',
                                TONE_SWATCH[name as CalloutTone],
                                tone === name && 'ring-primary ring-2'
                            )}
                            onClick={() => updateAttributes({ tone: name })}
                        />
                    ))}
                </div>
            )}
            <NodeViewContent<'div'> as="div" />
        </NodeViewWrapper>
    );
}
