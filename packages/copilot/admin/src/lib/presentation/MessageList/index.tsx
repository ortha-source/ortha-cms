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
import { AttachmentChip } from '../AttachmentChip';
import { SkillChip } from '../SkillChip';

const messages = defineMessages({
    attachments: {
        id: 'copilot.messages.attachments',
        defaultMessage: 'Attached files'
    },
    skills: {
        id: 'copilot.messages.skills',
        defaultMessage: 'Skills used'
    },
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
            className="flex-1 overflow-y-auto px-4 py-4"
            role="log"
            aria-label={intl.formatMessage(messages.transcript)}
            aria-live="polite"
        >
            {/* The scroller runs the full width so the scrollbar sits at the
                edge of the surface, but the text does not: a transcript read
                across a 1400px page is a transcript nobody finishes a line of.
                A no-op in the 420px docked panel, which never reaches the cap. */}
            <div className="mx-auto w-full max-w-3xl space-y-4">
                {turns.map((turn) => (
                    <Turn
                        key={turn.id}
                        turn={turn}
                        {...(onAnswer ? { onAnswer } : {})}
                    />
                ))}
                <div ref={endRef} />
            </div>
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
            <div className="flex flex-col items-end gap-1.5">
                <div className="bg-primary text-primary-foreground max-w-[85%] rounded-lg rounded-br-sm px-3 py-2 text-sm whitespace-pre-wrap">
                    {turn.text}
                </div>
                {/* Below the bubble rather than inside it: a chip on the
                    primary fill would need its own colour pair to stay legible,
                    and the file is a companion to the message, not part of the
                    sentence. */}
                {turn.attachments?.length ? (
                    <ul
                        className="flex max-w-[85%] flex-wrap justify-end gap-1.5"
                        aria-label={intl.formatMessage(messages.attachments)}
                    >
                        {turn.attachments.map((attachment) => (
                            <li key={attachment.assetId}>
                                <AttachmentChip
                                    name={attachment.name}
                                    size={attachment.size}
                                    kind={attachment.kind}
                                    // The library's own download route. It
                                    // derives its scope from membership, so the
                                    // link works for anyone who can see the
                                    // thread and 404s for anyone who cannot.
                                    href={`/api/media/assets/${attachment.assetId}/raw`}
                                />
                            </li>
                        ))}
                    </ul>
                ) : null}
                {/* The skills this turn ran under — including the workspace's
                    always-on ones, which nobody in this chat chose. Reading a
                    thread back, this is the only place anyone learns that an
                    answer was written under instructions they never saw. */}
                {turn.skills?.length ? (
                    <ul
                        className="flex max-w-[85%] flex-wrap justify-end gap-1.5"
                        aria-label={intl.formatMessage(messages.skills)}
                    >
                        {turn.skills.map((skill) => (
                            <li key={skill.name}>
                                <SkillChip title={skill.title} />
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* **In the order the run produced them.** These were three
                buckets — every step, then all the prose, then every change card
                — and the layout could not say when anything happened: a model
                that explained, saved, and kept writing showed the card pinned
                below text that was written after it. */}
            {turn.blocks.map((block) => {
                if (block.kind === 'text') {
                    return block.text ? (
                        <Markdown key={block.id} text={block.text} />
                    ) : null;
                }
                if (block.kind === 'step') {
                    return <ToolStep key={block.id} step={block.step} />;
                }
                // After the prose that introduces it and before whatever comes
                // next — a receipt where the change was made.
                return (
                    <ProposalCard key={block.id} proposal={block.proposal} />
                );
            })}

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

            {/* Also **between** tool calls, not only before the first one.
                The old condition bailed as soon as a step existed, so a turn
                that searched and then thought for three seconds showed a
                finished step and nothing else — the answer looked stuck. A
                running step has its own spinner, so this stands down for it
                rather than doubling up. */}
            {turn.streaming &&
                !turn.blocks.some(
                    (block) => block.kind === 'text' && block.text
                ) &&
                !turn.blocks.some(
                    (block) =>
                        block.kind === 'step' && block.step.status === 'running'
                ) && (
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
