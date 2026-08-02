import { defineMessages, useIntl } from 'react-intl';
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    type LucideIcon
} from 'lucide-react';
import { BLOCK_ALIGN, type BlockAlign } from '@ortha-cms/wysiwyg-core';
import { useEditor } from '../../editor/editorContext';
import { ToolbarButton } from '../ToolbarButton';

const messages = defineMessages({
    left: { id: 'wysiwyg.align.left', defaultMessage: 'Align left' },
    center: { id: 'wysiwyg.align.center', defaultMessage: 'Align centre' },
    right: { id: 'wysiwyg.align.right', defaultMessage: 'Align right' },
    justify: { id: 'wysiwyg.align.justify', defaultMessage: 'Justify' }
});

/** The four alignments, with the icon and label each reads as. */
const OPTIONS: readonly {
    align: BlockAlign;
    Icon: LucideIcon;
    message: keyof typeof messages;
}[] = [
    { align: BLOCK_ALIGN.Left, Icon: AlignLeft, message: 'left' },
    { align: BLOCK_ALIGN.Center, Icon: AlignCenter, message: 'center' },
    { align: BLOCK_ALIGN.Right, Icon: AlignRight, message: 'right' },
    { align: BLOCK_ALIGN.Justify, Icon: AlignJustify, message: 'justify' }
];

/**
 * The alignment control — four toggles rather than a dropdown, because
 * alignment is the one formatting choice people reach for repeatedly while
 * looking at the result, and a menu puts two clicks between each attempt.
 *
 * It acts on the **block selection** when there is one and on the last focused
 * block otherwise, the same rule every other toolbar control follows. Blocks
 * whose type does not align (a divider, a code block) leave it disabled rather
 * than hidden — a control that comes and goes as the caret moves is harder to
 * find than one that greys out.
 */
export function AlignControl() {
    const intl = useIntl();
    const {
        commands,
        schema,
        activePath,
        activeBlockType,
        activeBlockAttrs,
        selectedKeys
    } = useEditor();

    const selection = [...selectedKeys].map((key) => key.split('.').map(Number));
    const hasSelection = selection.length > 0;
    // With blocks selected the control is live regardless of what the caret
    // last touched — the selection is what will be aligned.
    const aligns =
        hasSelection || (schema.get(activeBlockType ?? '')?.aligns ?? false);
    const current = (activeBlockAttrs?.['align'] as string) ?? BLOCK_ALIGN.Left;

    const run = (align: BlockAlign) => {
        if (hasSelection) {
            commands.setAlignMany(selection, align);
            return;
        }
        if (activePath) commands.setAlign(activePath, align);
    };

    return (
        <>
            {OPTIONS.map(({ align, Icon, message }) => (
                <ToolbarButton
                    key={align}
                    label={intl.formatMessage(messages[message])}
                    // Nothing reads as "pressed" across a mixed selection, so
                    // the state shown is the caret's block; the action still
                    // applies to every selected block.
                    active={!hasSelection && current === align}
                    disabled={!aligns || (!activePath && !hasSelection)}
                    onClick={() => run(align)}
                >
                    <Icon aria-hidden className="size-4" />
                </ToolbarButton>
            ))}
        </>
    );
}
