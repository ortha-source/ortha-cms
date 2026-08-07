import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Maximize2,
    MessageSquarePlus,
    Minimize2,
    Minus,
    X
} from 'lucide-react';
import { Button, cn } from '@ortha-cms/design-system';
import { useCopilotChat } from '../../application/useCopilotChat';
import { Composer } from '../Composer';
import { MessageList } from '../MessageList';
import { ConversationPicker } from '../ConversationPicker';
import { ModelPicker } from '../ModelPicker';
import type { CopilotModelChoice } from '../../application/useCopilotModels';

// Product name is **Ortha AI**; the code keeps `copilot`. See the naming note
// in `docs/design/copilot.md`.
const messages = defineMessages({
    title: {
        id: 'copilot.panel.title',
        defaultMessage: 'Ortha AI'
    },
    description: {
        id: 'copilot.panel.description',
        defaultMessage:
            'Ask about the content in this workspace. Ortha AI acts with your permissions.'
    },
    newChat: {
        id: 'copilot.panel.newChat',
        defaultMessage: 'New chat'
    },
    minimize: {
        id: 'copilot.panel.minimize',
        defaultMessage: 'Minimize'
    },
    restore: {
        id: 'copilot.panel.restore',
        defaultMessage: 'Restore'
    },
    expand: {
        id: 'copilot.panel.expand',
        defaultMessage: 'Expand'
    },
    collapse: {
        id: 'copilot.panel.collapse',
        defaultMessage: 'Shrink'
    },
    close: {
        id: 'copilot.panel.close',
        defaultMessage: 'Close'
    }
});

/** How much of the window the panel takes. */
type PanelSize = 'docked' | 'expanded' | 'minimized';

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
    /** Focused when the panel closes, so keyboard focus doesn't fall to `<body>`. */
    returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * The chat panel — a **docked window** in the bottom-right corner, not a modal
 * drawer.
 *
 * That distinction is the whole point of the shape, not a cosmetic choice.
 * A `Sheet` is a modal dialog: it dims the page, traps focus, and blocks every
 * control behind it. But the useful thing to do with an answer about your
 * content is *act on it* — open the entry it named, check a field, run the
 * filter it suggested — and a modal makes you close the conversation to do any
 * of that. Docked and non-modal, the panel sits alongside the page: you can
 * scroll the records table, click into an entry, and keep the thread open
 * beside it.
 *
 * Consequences of being non-modal, all deliberate:
 * - **No focus trap.** Tab moves out of the panel and into the page, which is
 *   correct — the page is still live.
 * - **No overlay**, so nothing behind it is dimmed or click-blocked.
 * - Focus is still *managed*: the composer takes focus on open, and closing
 *   returns focus to whatever opened it rather than dropping it on `<body>`.
 * - Escape closes it, matching what every floating panel does.
 */
export function CopilotPanel({
    workspaceId,
    open,
    onOpenChange,
    returnFocusRef
}: CopilotPanelProps) {
    const intl = useIntl();
    const [size, setSize] = useState<PanelSize>('docked');

    // Escape closes. Bound on the panel's own subtree rather than the window,
    // so Escape inside a page dialog behind us doesn't also close the chat.
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onOpenChange(false);
        }
    };

    useEffect(() => {
        if (!open) {
            // Restore the default size for next time: reopening into a
            // minimized window reads as "the panel is broken".
            setSize('docked');
            returnFocusRef?.current?.focus();
        }
    }, [open, returnFocusRef]);

    if (!open) {
        return null;
    }

    const minimized = size === 'minimized';
    const expanded = size === 'expanded';

    return (
        <div
            role="dialog"
            // Deliberately no `aria-modal`: it defaults to false, which is
            // exactly right here. Setting it true would tell a screen reader
            // the rest of the page is inert when it isn't.
            aria-label={intl.formatMessage(messages.title)}
            onKeyDown={onKeyDown}
            className={cn(
                'bg-background fixed right-4 bottom-4 z-50 flex flex-col',
                'rounded-lg border shadow-lg',
                // Never taller or wider than the viewport allows, so the panel
                // stays usable on a laptop screen and on a short window.
                'max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]',
                minimized && 'w-[380px]',
                !minimized && !expanded && 'h-[620px] w-[420px]',
                expanded && 'h-[calc(100vh-2rem)] w-[min(820px,calc(100vw-2rem))]'
            )}
        >
            <header className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
                <h2 className="flex-1 truncate text-sm font-semibold">
                    {intl.formatMessage(messages.title)}
                </h2>

                <IconButton
                    icon={minimized ? Maximize2 : Minus}
                    label={intl.formatMessage(
                        minimized ? messages.restore : messages.minimize
                    )}
                    onClick={() => setSize(minimized ? 'docked' : 'minimized')}
                />
                {!minimized && (
                    <IconButton
                        icon={expanded ? Minimize2 : Maximize2}
                        label={intl.formatMessage(
                            expanded ? messages.collapse : messages.expand
                        )}
                        onClick={() =>
                            setSize(expanded ? 'docked' : 'expanded')
                        }
                    />
                )}
                <IconButton
                    icon={X}
                    label={intl.formatMessage(messages.close)}
                    onClick={() => onOpenChange(false)}
                />
            </header>

            {/* Minimized keeps the thread mounted — and therefore any run still
                streaming — so minimizing is genuinely "get this out of my way"
                rather than a disguised cancel. */}
            <div
                className={cn(
                    'flex min-h-0 flex-1 flex-col',
                    minimized && 'hidden'
                )}
            >
                {workspaceId ? (
                    <PanelBody key={workspaceId} workspaceId={workspaceId} />
                ) : (
                    <p className="text-muted-foreground p-4 text-sm">
                        {intl.formatMessage(messages.description)}
                    </p>
                )}
            </div>
        </div>
    );
}

/** A small square header control. */
function IconButton({
    icon: Icon,
    label,
    onClick
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick(): void;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-7 shrink-0"
            onClick={onClick}
            aria-label={label}
            title={label}
        >
            <Icon className="size-4" />
        </Button>
    );
}

function PanelBody({ workspaceId }: { workspaceId: string }) {
    const intl = useIntl();
    const chat = useCopilotChat(workspaceId);
    const composerRef = useRef<HTMLTextAreaElement>(null);
    // `null` means "let the host's resolver pick", which is a real choice
    // rather than the absence of one — see ModelPicker. Held here, not on the
    // thread: the model applies to the next turn, so a conversation can start
    // cheap and escalate.
    const [choice, setChoice] = useState<CopilotModelChoice | null>(null);

    // The panel is opened to type into, so put the cursor where it is needed.
    useEffect(() => {
        composerRef.current?.focus();
    }, []);

    return (
        <>
            <div className="flex shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5">
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
                    className="text-muted-foreground size-7"
                    onClick={chat.reset}
                    aria-label={intl.formatMessage(messages.newChat)}
                    title={intl.formatMessage(messages.newChat)}
                >
                    <MessageSquarePlus className="size-4" />
                </Button>
            </div>

            <MessageList messages={chat.messages} />

            <Composer
                busy={chat.busy}
                inputRef={composerRef}
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
