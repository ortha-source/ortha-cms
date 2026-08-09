import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@ortha-cms/design-system';
import type { ToolPermissionDecision } from '@ortha-cms/copilot-domain';
import type { ChatMessage } from '../../domain/types/chat';
import { Markdown } from '../Markdown';
import { ToolStep } from '../ToolStep';
import { ProposalCard } from '../ProposalCard';
import { PermissionPrompt } from '../PermissionPrompt';

const messages = defineMessages({
    empty: {
        id: 'copilot.chat.empty',
        defaultMessage: 'Ask about the content in this workspace.'
    },
    emptyHint: {
        id: 'copilot.chat.emptyHint',
        defaultMessage:
            'Ortha AI can only see and change what your own role allows. Every change it makes is recorded and can be undone.'
    },
    thinking: {
        id: 'copilot.chat.thinking',
        defaultMessage: 'Thinking…'
    },
    errorTitle: {
        id: 'copilot.chat.errorTitle',
        defaultMessage: 'Something went wrong'
    },
    incompleteTitle: {
        id: 'copilot.chat.incompleteTitle',
        defaultMessage: 'This answer is incomplete'
    },
    stoppedFor: {
        id: 'copilot.chat.stoppedFor',
        defaultMessage: 'Stopped because it {reason}.'
    },
    cancelled: {
        id: 'copilot.chat.cancelled',
        defaultMessage: 'You stopped this answer.'
    },
    transcript: {
        id: 'copilot.chat.transcript',
        defaultMessage: 'Conversation'
    }
});

/**
 * Stop reasons that mean the answer above is **truncated**, phrased to complete
 * "Stopped because it …". `end` is the normal case and says nothing; `aborted`
 * is deliberate and handled separately below.
 */
const TRUNCATING_STOP_REASONS: Record<string, string> = {
    'max-steps': 'reached the maximum number of steps',
    'max-tokens': 'reached this run’s token budget',
    timeout: 'took too long',
    'max-output-tokens': 'hit the response length limit',
    refusal: 'declined to answer'
};

/**
 * The transcript. Each turn shows the message, the tool steps it ran, and —
 * when the run ended for a reason other than a finished answer — a line saying
 * so, because a truncated answer that looks complete is worse than a short one.
 */
export function MessageList({
    messages: turns,
    onAnswer
}: {
    messages: ChatMessage[];
    /** Answers a parked tool call. Omitted, prompts render read-only. */
    onAnswer?(
        runId: string,
        callId: string,
        decision: ToolPermissionDecision
    ): void;
}) {
    const intl = useIntl();
    const endRef = useRef<HTMLDivElement>(null);

    // Follow the answer as it streams. `block: 'end'` keeps the newest line in
    // view without yanking the whole panel when a tool step expands.
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [turns]);

    if (turns.length === 0) {
        return (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
                <p className="text-sm">{intl.formatMessage(messages.empty)}</p>
                <p className="text-xs">
                    {intl.formatMessage(messages.emptyHint)}
                </p>
            </div>
        );
    }

    return (
        <div
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            role="log"
            aria-label={intl.formatMessage(messages.transcript)}
            aria-live="polite"
        >
            {turns.map((turn) => (
                <Turn
                    key={turn.id}
                    turn={turn}
                    {...(onAnswer ? { onAnswer } : {})}
                />
            ))}
            <div ref={endRef} />
        </div>
    );
}

function Turn({
    turn,
    onAnswer
}: {
    turn: ChatMessage;
    onAnswer?(
        runId: string,
        callId: string,
        decision: ToolPermissionDecision
    ): void;
}) {
    const intl = useIntl();
    const reason = turn.stopReason
        ? TRUNCATING_STOP_REASONS[turn.stopReason]
        : undefined;
    // Cancelling is something the user did on purpose, so it gets a quiet note
    // rather than a warning banner telling them about their own action.
    const cancelled = turn.stopReason === 'aborted';

    if (turn.role === 'user') {
        return (
            <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap">
                    {turn.text}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {turn.steps.length > 0 && (
                <div className="space-y-1.5">
                    {turn.steps.map((step) => (
                        <ToolStep key={step.id} step={step} />
                    ))}
                </div>
            )}

            {turn.text && <Markdown text={turn.text} />}

            {/* Before the change cards and after the steps: this is the one
                thing in the transcript the run is *blocked* on, so it belongs
                where the reader's eye already is — at the bottom of what has
                happened so far. */}
            {turn.permissions
                ?.filter((request) => !request.answered)
                .map((request) => (
                    <PermissionPrompt
                        key={request.id}
                        request={request}
                        onDecide={(decision) =>
                            onAnswer?.(request.runId, request.id, decision)
                        }
                    />
                ))}

            {/* After the answer, not before it: the prose is where the model
                explains what it did, and a receipt above its own explanation
                is a result with no account of itself. */}
            {turn.proposals && turn.proposals.length > 0 && (
                <div className="space-y-2">
                    {turn.proposals.map((proposal) => (
                        <ProposalCard key={proposal.id} proposal={proposal} />
                    ))}
                </div>
            )}

            {/* Also **between** tool calls, not only before the first one.
                The old condition bailed as soon as a step existed, so a turn
                that searched and then thought for three seconds showed a
                finished step and nothing else — the answer looked stuck. A
                running step has its own spinner, so this stands down for it
                rather than doubling up. */}
            {turn.streaming &&
                !turn.text &&
                !turn.steps.some((step) => step.status === 'running') && (
                    <p className="text-muted-foreground animate-pulse text-sm">
                        {intl.formatMessage(messages.thinking)}
                    </p>
                )}

            {/* A real Alert, not a line of red text: a failed turn is the one
                thing in the transcript a user must not scroll past, and the
                design system's `role="alert"` also gets it announced. */}
            {turn.error && (
                <Alert variant="destructive">
                    <CircleAlert className="size-4" />
                    <AlertTitle>
                        {intl.formatMessage(messages.errorTitle)}
                    </AlertTitle>
                    <AlertDescription>{turn.error}</AlertDescription>
                </Alert>
            )}

            {cancelled && !turn.error && (
                <p className="text-muted-foreground text-xs">
                    {intl.formatMessage(messages.cancelled)}
                </p>
            )}

            {/* A ceiling is not an error — the answer above is real, just cut
                short — so it is a warning rather than a destructive alert. It
                used to be muted 12px text under the answer, which is exactly
                where "this is truncated" goes unread. */}
            {reason && !turn.error && (
                <Alert variant="warning">
                    <TriangleAlert className="size-4" />
                    <AlertTitle>
                        {intl.formatMessage(messages.incompleteTitle)}
                    </AlertTitle>
                    <AlertDescription>
                        {intl.formatMessage(messages.stoppedFor, { reason })}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
