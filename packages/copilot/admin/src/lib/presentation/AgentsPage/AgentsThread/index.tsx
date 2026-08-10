import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CircleAlert } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Skeleton
} from '@ortha-cms/design-system';
import { useAgentThread } from '../../../application/useAgentThread';
import type { CopilotModelChoice } from '../../../application/useCopilotModels';
import type { RouteContext } from '../../../application/readRouteContext';
import { Composer } from '../../Composer';
import { ContextChip } from '../../ContextChip';
import { MessageList } from '../../MessageList';
import { AgentsWelcome } from '../AgentsWelcome';

const messages = defineMessages({
    failedTitle: {
        id: 'copilot.agents.thread.failedTitle',
        defaultMessage: 'Could not open this chat'
    },
    failedBody: {
        id: 'copilot.agents.thread.failedBody',
        defaultMessage:
            'The chat may have been removed, or the server could not be reached.'
    },
    retry: {
        id: 'copilot.agents.thread.retry',
        defaultMessage: 'Try again'
    }
});

export interface AgentsThreadProps {
    /** The workspace runs are scoped to. */
    workspaceId: string;
    /** Named in the empty state, so the scope of the chat is never in doubt. */
    workspaceName: string;
    /**
     * Where the user is, from the URL. Offered above the composer so a question
     * can be pinned to the page they were last on — see {@link ContextChip}.
     */
    routeContext: RouteContext;
    /**
     * Which backend the next turn runs on, or `null` for the host's resolver.
     * Owned by the page because the control that sets it lives in the top bar,
     * and it applies to the next turn rather than to the thread.
     */
    choice: CopilotModelChoice | null;
}

/**
 * The conversation column: what was said, and the box to say the next thing in.
 *
 * It is deliberately the **same** transcript, composer, tool steps, permission
 * prompts and change cards the docked panel renders. Two chat surfaces that
 * diverge is two chat surfaces to keep correct, and the parts worth getting
 * right — a permission prompt rendered inline rather than as a modal, a proposal
 * card attached to the turn that produced it — are exactly the parts that must
 * not be reimplemented at a larger size.
 */
export function AgentsThread({
    workspaceId,
    workspaceName,
    routeContext,
    choice
}: AgentsThreadProps) {
    const intl = useIntl();
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const { chat, loading, failed, retry } = useAgentThread(workspaceId);

    // Opt-in, and a snapshot rather than a live mirror of the URL: an attached
    // context should not silently change under the user as they navigate.
    const [attached, setAttached] = useState<RouteContext | null>(null);

    const send = (text: string) =>
        chat.send(
            text,
            {
                // Nothing attached means a plain chat turn — the model is told
                // where the user is only when they said so.
                surface: attached?.surface ?? 'chat',
                ...(attached?.contentType
                    ? { contentType: attached.contentType }
                    : {}),
                ...(attached?.entryId ? { entryId: attached.entryId } : {}),
                ...(attached?.locale ? { locale: attached.locale } : {})
            },
            {
                provider: choice?.provider ?? null,
                model: choice?.model ?? null
            }
        );

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {failed ? (
                <div className="mx-auto w-full max-w-3xl px-4 py-6">
                    <Alert variant="destructive">
                        <CircleAlert className="size-4" />
                        <AlertTitle>
                            {intl.formatMessage(messages.failedTitle)}
                        </AlertTitle>
                        <AlertDescription className="flex flex-col items-start gap-2">
                            {intl.formatMessage(messages.failedBody)}
                            <Button variant="outline" size="sm" onClick={retry}>
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                </div>
            ) : loading ? (
                // A skeleton of the *shape* a transcript has — one right-aligned
                // question, an answer under it — rather than a spinner, so the
                // page does not change size the instant the thread lands.
                <div
                    className="mx-auto w-full max-w-3xl flex-1 space-y-3 px-4 py-6"
                    aria-hidden
                >
                    <Skeleton className="ml-auto h-9 w-1/2 rounded-lg" />
                    <Skeleton className="h-4 w-11/12" />
                    <Skeleton className="h-4 w-9/12" />
                    <Skeleton className="h-4 w-10/12" />
                </div>
            ) : chat.messages.length === 0 ? (
                <AgentsWelcome
                    workspaceName={workspaceName}
                    onPick={(text) => {
                        send(text);
                        composerRef.current?.focus();
                    }}
                />
            ) : (
                <MessageList messages={chat.messages} onAnswer={chat.answer} />
            )}

            <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-2 pb-4">
                {/* "Your message, plus where you are" (design §2) — but only when
                    the user asked for it. See ContextChip for why it is opt-in. */}
                <ContextChip
                    current={routeContext}
                    attached={attached}
                    onAttach={() => setAttached(routeContext)}
                    onDetach={() => setAttached(null)}
                />
                <Composer
                    busy={chat.busy}
                    rows={3}
                    inputRef={composerRef}
                    // The page already centres and pads its own column, so the
                    // composer drops the panel's divider and gutters and
                    // contributes only the box itself.
                    className="border-t-0 p-0"
                    onSend={send}
                    onStop={chat.stop}
                />
            </div>
        </div>
    );
}
