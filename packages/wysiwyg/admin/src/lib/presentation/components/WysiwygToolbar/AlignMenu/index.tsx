import type { ComponentType } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import type { Editor } from '@tiptap/react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import { useLiveEditorState } from '../../../hooks/useLiveEditorState';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';

const messages = defineMessages({
    label: { id: 'wysiwyg.align.label', defaultMessage: 'Alignment' },
    left: { id: 'wysiwyg.toolbar.alignLeft', defaultMessage: 'Align left' },
    center: {
        id: 'wysiwyg.toolbar.alignCenter',
        defaultMessage: 'Align center'
    },
    right: { id: 'wysiwyg.toolbar.alignRight', defaultMessage: 'Align right' },
    justify: { id: 'wysiwyg.toolbar.alignJustify', defaultMessage: 'Justify' }
});

/** The four alignments, in reading order, with the icon that stands for each. */
const ALIGNMENTS: readonly {
    value: string;
    message: MessageDescriptor;
    icon: ComponentType<{ className?: string }>;
}[] = [
    { value: 'left', message: messages.left, icon: AlignLeft },
    { value: 'center', message: messages.center, icon: AlignCenter },
    { value: 'right', message: messages.right, icon: AlignRight },
    { value: 'justify', message: messages.justify, icon: AlignJustify }
];

/**
 * Text alignment, as one menu rather than four toggles.
 *
 * They are mutually exclusive — a block has exactly one alignment — so a radio
 * group is the honest control anyway, and it costs the bar one slot instead of
 * four. The trigger carries the current alignment's icon, so the collapsed form
 * still says which one is in effect.
 */
export function AlignMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const current = useLiveEditorState(
        editor,
        (instance) =>
            ALIGNMENTS.find((item) =>
                instance.isActive({ textAlign: item.value })
            )?.value ?? 'left',
        'left'
    );

    const active =
        ALIGNMENTS.find((item) => item.value === current) ?? ALIGNMENTS[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={intl.formatMessage(messages.label)}
                    icon={active.icon}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuRadioGroup
                    value={current}
                    onValueChange={(next) =>
                        editor.chain().focus().setTextAlign(next).run()
                    }
                >
                    {ALIGNMENTS.map((item) => (
                        <DropdownMenuRadioItem
                            key={item.value}
                            value={item.value}
                        >
                            <item.icon className="size-4" />
                            {intl.formatMessage(item.message)}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
