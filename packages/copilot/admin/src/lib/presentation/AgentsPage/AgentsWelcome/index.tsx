import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@orthacms/design-system';
import {
    useCopilotSuggestions,
    type CopilotSuggestion
} from '../../../application/useCopilotSuggestions';
import { suggestionCopy, type SuggestionCopy } from './suggestionCopy';

// The product is **Ortha CMS AI**; the code keeps `copilot`. See the naming note in
// `docs/design/copilot.md`.
const messages = defineMessages({
    title: {
        id: 'copilot.agents.welcome.title',
        defaultMessage: 'What can I help you with in {workspace}?'
    },
    subtitle: {
        id: 'copilot.agents.welcome.subtitle',
        defaultMessage:
            'I see and change only what your role allows. Every change asks first and is recorded in Activity.'
    },
    suggestions: {
        id: 'copilot.agents.welcome.suggestions',
        defaultMessage: 'Suggestions'
    },
    loading: {
        id: 'copilot.agents.welcome.loading',
        defaultMessage: 'Loading suggestions…'
    }
});

/** What a workspace with no openers to offer (or a failed request) shows. */
const FALLBACK: CopilotSuggestion[] = [{ kind: 'content-types' }];

export interface AgentsWelcomeProps {
    /** The workspace the openers are for. */
    workspaceId: string;
    /** Named in the greeting, so it is obvious which workspace is in scope. */
    workspaceName: string;
    /** Sends a suggestion as the first turn. */
    onPick(suggestion: CopilotSuggestion, copy: SuggestionCopy): void;
    /** The composer, which sits directly under the suggestions here. */
    children?: ReactNode;
}

/**
 * The new chat: a greeting, four openers written for **this** workspace, and
 * the composer right under them (R7, `AiNewChat`).
 *
 * **The openers come from the server** (`GET /copilot/suggestions`): it knows
 * the workspace's types, its skills and the tools this person is offered, so
 * "Find articles missing a summary" names a type that exists and is offered
 * only to someone who can draft one. They used to be four fixed sentences
 * that named no type at all. The admin words them (`suggestionCopy`), so they
 * translate with everything else.
 *
 * **The composer is in the middle of the page here**, not pinned to the
 * bottom: on an empty chat the question is the only thing on screen, and the
 * box you type it into belongs beside the suggestions for it. Once there is a
 * transcript it moves to the bottom, under the answer it replies to.
 *
 * The greeting is the visible title; the page's `<h1>` stays the product name
 * (visually hidden, in `AgentsPage`), so this is an `<h2>`.
 */
export function AgentsWelcome({
    workspaceId,
    workspaceName,
    onPick,
    children
}: AgentsWelcomeProps) {
    const intl = useIntl();
    const { data, isPending, isError } = useCopilotSuggestions(workspaceId);
    const suggestions =
        isError || (data && data.length === 0) ? FALLBACK : (data ?? []);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
            {/* `my-auto` rather than `justify-center` on the scroller: centred
                while it fits, and scrollable from the top when it does not. */}
            <div className="mx-auto my-auto flex w-full max-w-3xl flex-col gap-4">
                <div className="mb-2 flex flex-col items-center text-center">
                    <span
                        aria-hidden
                        className="bg-info-soft text-info mb-3 flex size-11 items-center justify-center rounded-xl"
                    >
                        <Sparkles className="size-5" />
                    </span>
                    <h2 className="text-[26px] leading-tight font-semibold tracking-tight text-balance">
                        {intl.formatMessage(messages.title, {
                            workspace: workspaceName
                        })}
                    </h2>
                    <p className="text-muted-foreground mt-1.5 text-sm text-pretty">
                        {intl.formatMessage(messages.subtitle)}
                    </p>
                </div>

                {isPending ? (
                    <div
                        role="status"
                        className="grid gap-3 sm:grid-cols-2"
                        aria-label={intl.formatMessage(messages.loading)}
                    >
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton
                                key={index}
                                aria-hidden
                                className="h-[68px] rounded-xl"
                            />
                        ))}
                    </div>
                ) : (
                    // Buttons, not links: picking one *sends a message*, which
                    // is an action on this page, not a destination.
                    <ul
                        aria-label={intl.formatMessage(messages.suggestions)}
                        className="grid gap-3 sm:grid-cols-2"
                    >
                        {suggestions.map((suggestion, index) => {
                            const copy = suggestionCopy(intl, suggestion);
                            return (
                                <li key={`${suggestion.kind}-${index}`}>
                                    <button
                                        type="button"
                                        onClick={() => onPick(suggestion, copy)}
                                        className="bg-card hover:bg-accent/40 focus-visible:ring-ring flex h-full w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    >
                                        <span className="text-sm font-medium">
                                            {copy.title}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {copy.hint}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {children}
            </div>
        </div>
    );
}
