import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MessageSquarePlus } from 'lucide-react';
import {
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle
} from '@ortha-cms/design-system';
import { useCopilotChat } from '../../application/useCopilotChat';
import { Composer } from '../Composer';
import { MessageList } from '../MessageList';
import { ConversationPicker } from '../ConversationPicker';
import { ModelPicker } from '../ModelPicker';
import type { CopilotModelChoice } from '../../application/useCopilotModels';

const messages = defineMessages({
    title: {
        id: 'copilot.panel.title',
        defaultMessage: 'Copilot'
    },
    description: {
        id: 'copilot.panel.description',
        defaultMessage:
            'Ask about the content in this workspace. The copilot acts with your permissions.'
    },
    newChat: {
        id: 'copilot.panel.newChat',
        defaultMessage: 'New chat'
    }
});

export interface CopilotPanelProps {
    /**
     * The workspace runs are scoped to. `null` outside a workspace, where the
     * panel renders only its header — every run route requires the header, so
     * a composer here could only produce a 400.
     */
    workspaceId: string | null;
    /** Whether the panel is open. */
    open: boolean;
    /** Called when the panel should open or close. */
    onOpenChange(open: boolean): void;
}

/**
 * The chat panel — a right-hand sheet in the workspace shell
 * ([`docs/design/copilot.md`](../../../../../../docs/design/copilot.md) §2).
 *
 * The chat state is owned by {@link useCopilotChat} and deliberately lives
 * **here**, inside the sheet, so closing the panel ends the run and clears the
 * transcript rather than leaving a stream running behind a closed door. A
 * conversation is persisted server-side from the first turn, so nothing is lost
 * — reopening and picking the thread restores it.
 */
export function CopilotPanel({
    workspaceId,
    open,
    onOpenChange
}: CopilotPanelProps) {
    const intl = useIntl();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
            >
                {/* Remounted per workspace: a thread belongs to one workspace,
                    and carrying a transcript across a switch would show content
                    the new workspace may not even grant. */}
                {workspaceId ? (
                    <PanelBody key={workspaceId} workspaceId={workspaceId} />
                ) : (
                    <SheetHeader className="p-4">
                        <SheetTitle>
                            {intl.formatMessage(messages.title)}
                        </SheetTitle>
                        <SheetDescription>
                            {intl.formatMessage(messages.description)}
                        </SheetDescription>
                    </SheetHeader>
                )}
            </SheetContent>
        </Sheet>
    );
}

function PanelBody({ workspaceId }: { workspaceId: string }) {
    const intl = useIntl();
    const chat = useCopilotChat(workspaceId);
    // `null` means "let the host's resolver pick", which is a real choice
    // rather than the absence of one — see ModelPicker. Held in the panel, not
    // the thread: the model applies to the next turn, so a conversation can
    // start cheap and escalate when the question gets harder.
    const [choice, setChoice] = useState<CopilotModelChoice | null>(null);

    return (
        <>
            <SheetHeader className="border-border/60 flex-row items-center justify-between space-y-0 border-b p-3 pr-12">
                <div className="min-w-0">
                    <SheetTitle className="text-sm">
                        {intl.formatMessage(messages.title)}
                    </SheetTitle>
                    {/* Present for the dialog's accessible description even
                        though the visual design keeps the header to one line. */}
                    <SheetDescription className="sr-only">
                        {intl.formatMessage(messages.description)}
                    </SheetDescription>
                </div>

                <div className="flex items-center gap-1">
                    <ModelPicker value={choice} onChange={setChoice} />
                    <ConversationPicker
                        workspaceId={workspaceId}
                        onOpen={(conversationId, loaded) =>
                            chat.load(conversationId, loaded)
                        }
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={chat.reset}
                        aria-label={intl.formatMessage(messages.newChat)}
                        title={intl.formatMessage(messages.newChat)}
                    >
                        <MessageSquarePlus className="size-4" />
                    </Button>
                </div>
            </SheetHeader>

            <MessageList messages={chat.messages} />

            <Composer
                busy={chat.busy}
                onSend={(text) =>
                    chat.send(
                        text,
                        { surface: 'chat' },
                        {
                            provider: choice?.provider ?? null,
                            model: choice?.model ?? null
                        }
                    )
                }
                onStop={chat.stop}
            />
        </>
    );
}
