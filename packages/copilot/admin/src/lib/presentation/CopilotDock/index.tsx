import { defineMessages, useIntl } from 'react-intl';
import { Check, Loader2, MoreHorizontal, Sparkles, X } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@orthacms/design-system';
import type { CopilotSession } from '../../application/sessions';
import { useThreadActivity } from '../../application/useThreadActivity';
import {
    NEW_CHAT_KEY_SHORTCUTS,
    shortcutModifierGlyph
} from '../../domain/shortcut';

// The product is **Ortha CMS AI**; the code keeps `copilot`. See the naming note in
// `docs/design/copilot.md`.
const messages = defineMessages({
    label: {
        id: 'copilot.dock.label',
        defaultMessage: 'Ortha CMS AI chats'
    },
    start: {
        id: 'copilot.dock.start',
        defaultMessage: 'Ask Ortha AI'
    },
    // Deliberately not "New chat": two controls in one region answering to
    // the same name is ambiguous by voice and in a control list.
    untitled: {
        id: 'copilot.dock.untitled',
        defaultMessage: 'Untitled chat'
    },
    unread: {
        id: 'copilot.dock.unread',
        defaultMessage: '{title} — finished'
    },
    // Distinct from "finished" on purpose: this chat has not finished, it has
    // stopped and is blocked on you.
    awaiting: {
        id: 'copilot.dock.awaiting',
        defaultMessage: '{title} — waiting for you'
    },
    working: {
        id: 'copilot.dock.working',
        defaultMessage: '{title} — working…'
    },
    close: {
        id: 'copilot.dock.close',
        defaultMessage: 'Close {title}'
    },
    more: {
        id: 'copilot.dock.more',
        defaultMessage:
            '{count, plural, one {# more chat} other {# more chats}}'
    }
});

/**
 * How many pills the strip draws before the rest fold into "N more". The strip
 * under the card is one line, and it shares it with the launcher.
 */
const MAX_PILLS = 3;

/**
 * The tooltip opens on **hover only**, never on focus. Focus is handed back to
 * the launcher every time a chat window collapses, and a tooltip opened by
 * that would hang over the window docked just beneath it — where it swallowed
 * clicks on that window's own header buttons.
 */
function suppressFocusTooltip(event: React.FocusEvent) {
    event.preventDefault();
}

/** What a collapsed chat says about itself, in words. */
type PillState = 'awaiting' | 'unread' | 'working' | 'idle';

/**
 * **The dock** — collapsed chats as pills, and "Ask Ortha AI", in the strip
 * under the work area's card (design-system `InsetFooterEnd`).
 *
 * R7 (`AiWindow`): "Up to three windows; others wait as pills in the dock". A
 * pill per **collapsed** chat, saying what it is doing in words — "Audit author
 * bios — waiting for you" with the amber dot, "SEO titles — finished" with a
 * tick — and opening it again on click. A chat on screen has its window and
 * needs no pill.
 *
 * It used to be a launcher that turned into a popover listing every chat,
 * which hid the one thing the dock exists to say — that a chat in the
 * background wants you — behind a click. The pills put it in plain sight.
 *
 * **In the strip, not over the page.** The board draws them floating over the
 * bottom-left of the work area; a bar of pills fixed over the page is what
 * once covered the records pagination and every scroll area's last row, so
 * they stay in the strip under the card, beside the launcher. Same pills, a
 * place that covers nothing.
 *
 * - **Waiting outranks finished outranks working**, and each is in the pill's
 *   accessible name, not only in its mark.
 * - **Close is its own control with its own name**, because it ends a run and
 *   sits a few pixels from the thing that merely restores one.
 * - **"Ask Ortha AI" always starts a chat**, with `⌘J` taught by its tooltip.
 *   `newChatRef` lands on it whenever a window goes away: it is the one
 *   control guaranteed to still be there.
 */
export function CopilotDock({
    sessions,
    onToggle,
    onClose,
    onNewChat,
    newChatRef
}: {
    sessions: readonly CopilotSession[];
    onToggle(id: string): void;
    onClose(id: string): void;
    onNewChat(): void;
    /** Focus lands here when a chat closes, so it never falls to `<body>`. */
    newChatRef?: React.RefObject<HTMLButtonElement | null>;
}) {
    const intl = useIntl();
    const activity = useThreadActivity();
    const shortcutGlyph = `${shortcutModifierGlyph()}J`;
    const collapsed = sessions.filter((session) => session.minimized);
    const shown = collapsed.slice(0, MAX_PILLS);
    const folded = collapsed.slice(MAX_PILLS);

    const describe = (session: CopilotSession) => {
        const title = session.title ?? intl.formatMessage(messages.untitled);
        const state: PillState = session.awaiting
            ? 'awaiting'
            : session.unread
              ? 'unread'
              : session.conversationId &&
                  activity.get(session.conversationId) === 'working'
                ? 'working'
                : 'idle';
        const label =
            state === 'idle'
                ? title
                : intl.formatMessage(messages[state], { title });
        return { title, state, label };
    };

    return (
        <div className="flex min-w-0 items-center gap-2">
            {collapsed.length > 0 ? (
                <div
                    role="group"
                    aria-label={intl.formatMessage(messages.label)}
                    className="flex min-w-0 items-center gap-1.5"
                >
                    {shown.map((session) => {
                        const { title, state, label } = describe(session);
                        return (
                            <div
                                key={session.id}
                                className="bg-background flex h-7 max-w-64 min-w-0 items-center rounded-full border shadow-xs"
                            >
                                <button
                                    type="button"
                                    onClick={() => onToggle(session.id)}
                                    title={label}
                                    className="focus-visible:ring-ring flex h-full min-w-0 items-center gap-2 rounded-full pr-1 pl-3 text-[12.5px] focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <PillMarker state={state} />
                                    <span className="min-w-0 truncate">
                                        {label}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose(session.id);
                                        requestAnimationFrame(() =>
                                            newChatRef?.current?.focus()
                                        );
                                    }}
                                    aria-label={intl.formatMessage(
                                        messages.close,
                                        { title }
                                    )}
                                    className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring mr-1 shrink-0 rounded-full p-1 focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <X aria-hidden className="size-3" />
                                </button>
                            </div>
                        );
                    })}
                    {folded.length > 0 ? (
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="bg-background h-7 gap-1 rounded-full px-2.5 text-[12.5px] shadow-xs"
                                >
                                    <MoreHorizontal
                                        aria-hidden
                                        className="size-3.5"
                                    />
                                    {intl.formatMessage(messages.more, {
                                        count: folded.length
                                    })}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                align="end"
                                className="w-72"
                            >
                                {folded.map((session) => {
                                    const { state, label } = describe(session);
                                    return (
                                        <DropdownMenuItem
                                            key={session.id}
                                            onSelect={() =>
                                                onToggle(session.id)
                                            }
                                            className="gap-2"
                                        >
                                            <PillMarker state={state} />
                                            <span className="min-w-0 truncate">
                                                {label}
                                            </span>
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                </div>
            ) : null}

            <Tooltip>
                <TooltipTrigger asChild onFocus={suppressFocusTooltip}>
                    <Button
                        ref={newChatRef}
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onNewChat}
                        // Its name is its visible label (WCAG 2.5.3) — what
                        // makes "click Ask Ortha AI" work by voice.
                        aria-label={intl.formatMessage(messages.start)}
                        // Both accepted chords, so assistive tech announces
                        // the one its user can actually press.
                        aria-keyshortcuts={NEW_CHAT_KEY_SHORTCUTS}
                        className="text-muted-foreground hover:text-foreground h-7 shrink-0 gap-1.5 px-2"
                    >
                        <Sparkles aria-hidden className="size-4" />
                        {intl.formatMessage(messages.start)}
                    </Button>
                </TooltipTrigger>
                {/* The tooltip names the product and teaches the shortcut —
                    the glyph is `aria-hidden`, since the name and
                    `aria-keyshortcuts` already say both. */}
                <TooltipContent side="top" className="flex items-center gap-2">
                    {intl.formatMessage(messages.start)}
                    <span aria-hidden className="opacity-70">
                        {shortcutGlyph}
                    </span>
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

/** The pill's state as a mark: amber dot, tick, spinner — or nothing. */
function PillMarker({ state }: { state: PillState }) {
    if (state === 'awaiting') {
        return (
            <span
                aria-hidden
                data-marker="awaiting"
                className="bg-warning size-[7px] shrink-0 rounded-full"
            />
        );
    }
    if (state === 'unread') {
        return (
            <Check
                aria-hidden
                data-marker="unread"
                className="size-3.5 shrink-0"
            />
        );
    }
    if (state === 'working') {
        return (
            <Loader2
                aria-hidden
                data-marker="working"
                className="text-info size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
        );
    }
    return null;
}
