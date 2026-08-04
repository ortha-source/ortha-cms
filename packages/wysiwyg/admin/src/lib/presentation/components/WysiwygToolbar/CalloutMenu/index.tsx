import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import type { ComponentType } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
    CircleCheck,
    Info,
    OctagonAlert,
    TriangleAlert
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import {
    CALLOUT_TONE,
    CALLOUT_TONES,
    type CalloutTone
} from '../../../../domain/constants';
import { ToolbarMenuTrigger } from '../ToolbarMenuTrigger';

const messages = defineMessages({
    label: { id: 'wysiwyg.callout.label', defaultMessage: 'Callout' },
    info: { id: 'wysiwyg.callout.info', defaultMessage: 'Note' },
    success: { id: 'wysiwyg.callout.success', defaultMessage: 'Success' },
    warning: { id: 'wysiwyg.callout.warning', defaultMessage: 'Warning' },
    danger: { id: 'wysiwyg.callout.danger', defaultMessage: 'Danger' },
    remove: {
        id: 'wysiwyg.callout.remove',
        defaultMessage: 'Remove callout'
    }
});

/** Each tone's menu label and leading icon. */
const TONE_VIEW: Record<
    CalloutTone,
    { message: MessageDescriptor; icon: ComponentType<{ className?: string }> }
> = {
    [CALLOUT_TONE.Info]: { message: messages.info, icon: Info },
    [CALLOUT_TONE.Success]: { message: messages.success, icon: CircleCheck },
    [CALLOUT_TONE.Warning]: { message: messages.warning, icon: TriangleAlert },
    [CALLOUT_TONE.Danger]: { message: messages.danger, icon: OctagonAlert }
};

/**
 * Wraps the selection in a callout — the tinted "Note / Warning" aside — or
 * re-tones the one it is already in. Picking a second tone never nests a
 * callout inside a callout; that's handled by the node's `setCallout`.
 *
 * "Remove callout" is offered only when the caret is inside one, so the menu
 * never lists an action that would do nothing.
 */
export function CalloutMenu({ editor }: { editor: Editor }) {
    const intl = useIntl();
    const active = useEditorState({
        editor,
        selector: ({ editor: instance }) => {
            if (!instance.isActive('callout')) return undefined;
            const tone = instance.getAttributes('callout')['tone'];
            return (
                CALLOUT_TONES.find((candidate) => candidate === tone) ??
                CALLOUT_TONE.Info
            );
        }
    });

    const label = intl.formatMessage(messages.label);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <ToolbarMenuTrigger
                    label={label}
                    icon={active ? TONE_VIEW[active].icon : Info}
                    active={active !== undefined}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
                {CALLOUT_TONES.map((tone) => {
                    const { message, icon: Icon } = TONE_VIEW[tone];
                    return (
                        <DropdownMenuItem
                            key={tone}
                            onSelect={() =>
                                editor.chain().focus().setCallout(tone).run()
                            }
                        >
                            <Icon className="size-4" />
                            {intl.formatMessage(message)}
                        </DropdownMenuItem>
                    );
                })}
                {active ? (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onSelect={() =>
                                editor.chain().focus().unsetCallout().run()
                            }
                        >
                            {intl.formatMessage(messages.remove)}
                        </DropdownMenuItem>
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
