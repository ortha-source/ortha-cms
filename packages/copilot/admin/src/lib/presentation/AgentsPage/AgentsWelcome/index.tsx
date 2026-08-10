import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { ArrowUpRight, Sparkles } from 'lucide-react';

// The product is **Ortha AI**; the code keeps `copilot`. See the naming note in
// `docs/design/copilot.md`.
const messages = defineMessages({
    title: {
        id: 'copilot.agents.welcome.title',
        defaultMessage: 'What can I help you with in {workspace}?'
    },
    subtitle: {
        id: 'copilot.agents.welcome.subtitle',
        defaultMessage:
            'Ortha AI can only see and change what your own role allows. Every change it makes is recorded.'
    },
    suggestions: {
        id: 'copilot.agents.welcome.suggestions',
        defaultMessage: 'Try one of these'
    },
    types: {
        id: 'copilot.agents.welcome.types',
        defaultMessage: 'What content types can I work with here?'
    },
    recent: {
        id: 'copilot.agents.welcome.recent',
        defaultMessage: 'Summarise what changed in this workspace this week'
    },
    audit: {
        id: 'copilot.agents.welcome.audit',
        defaultMessage: 'Find published entries that are missing a description'
    },
    draft: {
        id: 'copilot.agents.welcome.draft',
        defaultMessage:
            'Draft a new entry and show me the change before I keep it'
    }
});

/**
 * The four openers.
 *
 * Each one maps onto a tool the copilot actually has — the content-type
 * catalogue, the activity feed, entry search, and the propose-a-change path. A
 * suggestion chip is a promise about what the assistant can do, and one that
 * lands on "I can't do that" is worse than an empty screen.
 */
const SUGGESTIONS: MessageDescriptor[] = [
    messages.types,
    messages.recent,
    messages.audit,
    messages.draft
];

export interface AgentsWelcomeProps {
    /** Named in the greeting, so it is obvious which workspace is in scope. */
    workspaceName: string;
    /** Sends a suggestion as the first turn. */
    onPick(text: string): void;
}

/**
 * The empty thread: a greeting and four things worth asking.
 *
 * It stands in for {@link MessageList}'s own empty state rather than sitting
 * above it, because a full page has room to *offer* something and a 420px panel
 * does not. The suggestions are the answer to the blank-composer problem — the
 * hard part of a copilot is not typing, it is knowing what it can be asked.
 */
export function AgentsWelcome({ workspaceName, onPick }: AgentsWelcomeProps) {
    const intl = useIntl();

    return (
        <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
            <div className="w-full max-w-2xl">
                <div className="flex flex-col items-center text-center">
                    <span
                        className="bg-primary/10 text-primary mb-4 grid size-11 place-items-center rounded-xl"
                        aria-hidden
                    >
                        <Sparkles className="size-5" />
                    </span>
                    <h2 className="text-xl font-semibold text-balance">
                        {intl.formatMessage(messages.title, {
                            workspace: workspaceName
                        })}
                    </h2>
                    <p className="text-muted-foreground mt-2 max-w-md text-sm text-pretty">
                        {intl.formatMessage(messages.subtitle)}
                    </p>
                </div>

                <h3 className="text-muted-foreground mt-8 mb-2 text-[11px] font-medium tracking-wide uppercase">
                    {intl.formatMessage(messages.suggestions)}
                </h3>
                {/* Buttons, not links or cards: picking one *sends a message*,
                    which is an action on this page and not a destination. */}
                <ul className="grid gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((suggestion) => {
                        const text = intl.formatMessage(suggestion);
                        return (
                            <li key={suggestion.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(text)}
                                    className="hover:bg-accent/60 focus-visible:ring-ring group flex h-full w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <span className="flex-1 text-pretty">
                                        {text}
                                    </span>
                                    <ArrowUpRight
                                        className="text-muted-foreground mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                        aria-hidden
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
