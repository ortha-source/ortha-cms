import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Sparkles, X } from 'lucide-react';
import {
    Button,
    cn,
    Kbd,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@orthacms/design-system';
import type { CopilotSession } from '../../application/sessions';
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
    newChat: {
        id: 'copilot.dock.newChat',
        defaultMessage: 'New chat'
    },
    start: {
        id: 'copilot.dock.start',
        defaultMessage: 'Ortha CMS AI'
    },
    // With nothing open this button *reads* "Ortha CMS AI" and used to *announce*
    // "New chat", so its visible label was not in its accessible name at all —
    // WCAG 2.5.3, and the exact thing that stops "click Ortha CMS AI" working for
    // anyone driving the admin by voice. Now the name contains the visible text.
    startFull: {
        id: 'copilot.dock.startFull',
        defaultMessage: 'Ortha CMS AI — new chat'
    },
    // Deliberately not "New chat": that is the name of the button beside it,
    // and two controls in one toolbar answering to the same name is ambiguous
    // to anyone driving this by voice or by a screen reader's control list.
    untitled: {
        id: 'copilot.dock.untitled',
        defaultMessage: 'Untitled chat'
    },
    unread: {
        id: 'copilot.dock.unread',
        defaultMessage: '{title} — finished'
    },
    // Distinct from "finished" on purpose: this chat has not finished, it has
    // stopped and is blocked on you. Conflating the two would let the more
    // urgent state hide behind the routine one.
    awaiting: {
        id: 'copilot.dock.awaiting',
        defaultMessage: '{title} — waiting for you'
    },
    close: {
        id: 'copilot.dock.close',
        defaultMessage: 'Close {title}'
    },
    // The launcher once chats exist. It still starts with the product's name —
    // the visible label — so "click Ortha CMS AI" keeps working by voice
    // (2.5.3); the count and any chat wanting attention follow it, because a
    // closed list must not hide that something finished or is waiting.
    chats: {
        id: 'copilot.dock.chats',
        defaultMessage:
            'Ortha CMS AI — {count, plural, one {# chat} other {# chats}}'
    },
    chatsAttention: {
        id: 'copilot.dock.chatsAttention',
        defaultMessage:
            'Ortha CMS AI — {count, plural, one {# chat} other {# chats}}, {attention} waiting for you or finished'
    }
});

/**
 * The copilot's entry point, **in the top bar** — at its right end on every
 * page, through the design system's `InsetBarEnd`.
 *
 * It used to be a pill bar floating `fixed` over the bottom-right corner of the
 * page, and to keep it from covering the records pagination and the Properties
 * rail's buttons it published a bottom gutter every scrollport reserved: 66px of
 * empty space under every page, and 24px on the Agents view where the bar was
 * not even drawn. A control in the bar covers nothing, so the gutter is gone.
 *
 * Two shapes:
 *
 * It is **an icon, not a labelled button**: the bar is the page's own chrome,
 * and a word-and-shortcut chip at its end competed with the page's actions
 * beside it. The name lives where an icon button keeps it — the accessible
 * name and a tooltip, which also carries the shortcut.
 *
 * - **No chats:** clicking the icon opens a new chat straight away.
 * - **Chats open:** the icon carries a count and a dot when a chat wants
 *   attention, and opens a list of the chats. The list keeps everything the
 *   pill bar had to get right:
 *   - **a row for a chat you cannot see says something happened in it** — the
 *     dot, and the same words in its accessible name ("— finished", "— waiting
 *     for you"; waiting outranks finished);
 *   - **a row toggles** its window, with `aria-pressed` saying which state it
 *     is in;
 *   - **Close is its own control with its own name**, because it ends a run
 *     and sits a few pixels from the thing that merely hides one.
 *
 * `newChatRef` lands on the launcher either way: it is the one control
 * guaranteed to still be there when a window goes away.
 */
/**
 * The tooltip opens on **hover only**, never on focus. Focus is handed back to
 * this icon every time a chat window collapses, and a tooltip opened by that
 * would hang over the top of the window docked just beneath the bar — where it
 * swallowed clicks on that window's own header buttons. A focused reader loses
 * nothing: the button's name and `aria-keyshortcuts` say what the tooltip says.
 * Radix skips its own focus handler when the event arrives default-prevented.
 */
function suppressFocusTooltip(event: React.FocusEvent) {
    event.preventDefault();
}

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
    const [open, setOpen] = useState(false);
    const shortcutGlyph = `${shortcutModifierGlyph()}J`;
    const shortcut = (
        <Kbd className="hidden md:inline-flex">{shortcutGlyph}</Kbd>
    );
    // The tooltip names the product and teaches the shortcut — the two things
    // the icon alone cannot say. `aria-hidden` on the glyph copy: the button's
    // own name and `aria-keyshortcuts` already say both to assistive tech.
    const tooltip = (
        <TooltipContent side="bottom" className="flex items-center gap-2">
            {intl.formatMessage(messages.start)}
            <span aria-hidden className="opacity-70">
                {shortcutGlyph}
            </span>
        </TooltipContent>
    );
    const iconButton =
        'relative size-8 text-muted-foreground hover:text-foreground';

    if (sessions.length === 0) {
        return (
            <Tooltip>
                <TooltipTrigger asChild onFocus={suppressFocusTooltip}>
                    <Button
                        ref={newChatRef}
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onNewChat}
                        aria-label={intl.formatMessage(messages.startFull)}
                        // Both accepted chords, so assistive tech announces the
                        // one its user can actually press rather than a glyph.
                        aria-keyshortcuts={NEW_CHAT_KEY_SHORTCUTS}
                        className={iconButton}
                    >
                        <Sparkles aria-hidden className="size-4" />
                    </Button>
                </TooltipTrigger>
                {tooltip}
            </Tooltip>
        );
    }

    const attention = sessions.filter((s) => s.awaiting || s.unread).length;
    const anyAwaiting = sessions.some((s) => s.awaiting);
    const launcherLabel = intl.formatMessage(
        attention > 0 ? messages.chatsAttention : messages.chats,
        { count: sessions.length, attention }
    );

    return (
        // Non-modal, like every other overlay a chat can be driven from: the
        // windows it opens sit over a page that stays live.
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild onFocus={suppressFocusTooltip}>
                    <PopoverTrigger asChild>
                        <Button
                            ref={newChatRef}
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={launcherLabel}
                            className={iconButton}
                        >
                            <Sparkles aria-hidden className="size-4" />
                            {/* The count sits on the icon's corner; the dot
                                for a chat wanting attention on the other. Both
                                are said in the button's name as well. */}
                            <span
                                aria-hidden
                                className="absolute -right-1 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[0.625rem] leading-none font-semibold tabular-nums text-background"
                            >
                                {sessions.length}
                            </span>
                            {attention > 0 && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2 ring-background',
                                        anyAwaiting
                                            ? 'bg-warning'
                                            : 'bg-primary'
                                    )}
                                />
                            )}
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                {/* No tooltip over an open list — it would sit on top of it. */}
                {open ? null : tooltip}
            </Tooltip>
            <PopoverContent
                align="end"
                aria-label={intl.formatMessage(messages.label)}
                className="w-80 p-1"
            >
                <div className="flex flex-col gap-0.5">
                    {sessions.map((session) => {
                        const title =
                            session.title ??
                            intl.formatMessage(messages.untitled);
                        return (
                            <div
                                key={session.id}
                                className="flex items-center gap-0.5"
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOpen(false);
                                        onToggle(session.id);
                                    }}
                                    aria-pressed={!session.minimized}
                                    // The marker is in the name, not only in
                                    // the dot — and `awaiting` outranks
                                    // `unread`, because a chat blocked on a
                                    // question is the one to open first.
                                    aria-label={
                                        session.awaiting
                                            ? intl.formatMessage(
                                                  messages.awaiting,
                                                  { title }
                                              )
                                            : session.unread
                                              ? intl.formatMessage(
                                                    messages.unread,
                                                    { title }
                                                )
                                              : title
                                    }
                                    title={title}
                                    className={cn(
                                        'focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none',
                                        session.minimized
                                            ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                            : 'bg-secondary text-secondary-foreground'
                                    )}
                                >
                                    <Sparkles
                                        aria-hidden
                                        className="size-3.5 shrink-0"
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                        {title}
                                    </span>
                                    {(session.awaiting || session.unread) && (
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'size-1.5 shrink-0 rounded-full',
                                                // Amber for "answer me",
                                                // primary for "there is
                                                // something to read". The
                                                // colour is a nicety on top of
                                                // the name — never the only
                                                // signal.
                                                session.awaiting
                                                    ? 'bg-warning'
                                                    : 'bg-primary'
                                            )}
                                        />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose(session.id);
                                        // The last close empties the list and
                                        // unmounts it; the launcher it turns
                                        // back into is where focus belongs.
                                        if (sessions.length === 1) {
                                            requestAnimationFrame(() =>
                                                newChatRef?.current?.focus()
                                            );
                                        }
                                    }}
                                    aria-label={intl.formatMessage(
                                        messages.close,
                                        { title }
                                    )}
                                    className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm p-1.5 focus-visible:ring-2 focus-visible:outline-none"
                                >
                                    <X aria-hidden className="size-3.5" />
                                </button>
                            </div>
                        );
                    })}
                    <div className="my-1 border-t" />
                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false);
                            onNewChat();
                        }}
                        aria-label={intl.formatMessage(messages.newChat)}
                        aria-keyshortcuts={NEW_CHAT_KEY_SHORTCUTS}
                        className="focus-visible:ring-ring flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:outline-none"
                    >
                        <Plus aria-hidden className="size-3.5" />
                        <span className="flex-1 text-left">
                            {intl.formatMessage(messages.newChat)}
                        </span>
                        {shortcut}
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
