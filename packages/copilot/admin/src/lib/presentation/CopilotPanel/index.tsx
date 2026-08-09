import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    GripVertical,
    Maximize2,
    MessageSquarePlus,
    Minimize2,
    Minus,
    X
} from 'lucide-react';
import { Button, cn } from '@ortha-cms/design-system';
import { useCopilotChat } from '../../application/useCopilotChat';
import {
    keyboardStep,
    usePanelFrame,
    type PanelFrameControls
} from '../../application/usePanelFrame';
import { Composer } from '../Composer';
import { MessageList } from '../MessageList';
import { ConversationPicker } from '../ConversationPicker';
import { ModelPicker } from '../ModelPicker';
import { PanelResizeHandles } from '../PanelResizeHandles';
import type { CopilotModelChoice } from '../../application/useCopilotModels';
import type { RouteContext } from '../../application/readRouteContext';
import { ContextChip } from '../ContextChip';

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
    },
    move: {
        id: 'copilot.panel.move',
        defaultMessage: 'Move Ortha AI'
    },
    moveHint: {
        id: 'copilot.panel.moveHint',
        defaultMessage:
            'Drag to move. With this focused, arrow keys move; hold Shift for larger steps.'
    }
});

/** Which arrow key moves which way, as a `[dx, dy]` unit vector. */
const ARROWS: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
};

/** How much of the window the panel takes. */
type PanelSize = 'docked' | 'expanded' | 'minimized';

/**
 * Enter/exit duration, in ms. Must match the `duration-200` class below — the
 * timeout is what unmounts the panel after the exit transition, and unmounting
 * early would cut the animation off mid-way.
 */
const MOTION_MS = 200;

export interface CopilotPanelProps {
    /**
     * The workspace runs are scoped to. `null` outside a workspace, where the
     * panel renders only its header — every run route requires the header, so
     * a composer here could only produce a 400.
     */
    workspaceId: string | null;
    /**
     * Where the user is, from the URL. Sent with every turn so the model can
     * resolve "this entry" and "here", and shown above the composer so the user
     * can see what is being attached.
     */
    routeContext: RouteContext;
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
    routeContext,
    open,
    onOpenChange,
    returnFocusRef
}: CopilotPanelProps) {
    const intl = useIntl();
    const [size, setSize] = useState<PanelSize>('docked');
    // Where the user dragged it to, if they have. `null` until then, which is
    // what keeps the docked/expanded classes below meaningful.
    const frame = usePanelFrame();
    // `rendered` keeps the panel in the tree long enough to play the exit
    // transition; `visible` drives the transition itself. Two states rather
    // than one because the element has to mount in its hidden position *first*,
    // then flip to visible on a later frame — set both at once and the browser
    // has nothing to transition from.
    const [rendered, setRendered] = useState(open);
    const [visible, setVisible] = useState(false);

    // Escape closes. Bound on the panel's own subtree rather than the window,
    // so Escape inside a page dialog behind us doesn't also close the chat.
    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onOpenChange(false);
        }
    };

    useEffect(() => {
        if (open) {
            setRendered(true);
            // Two frames: the first commits the mounted-but-hidden element, the
            // second starts the transition. One frame is enough in most
            // browsers and flaky in the rest.
            let inner = 0;
            const outer = requestAnimationFrame(() => {
                inner = requestAnimationFrame(() => setVisible(true));
            });
            return () => {
                cancelAnimationFrame(outer);
                cancelAnimationFrame(inner);
            };
        }

        setVisible(false);
        const timer = setTimeout(() => {
            setRendered(false);
            // Restore the default size for next time: reopening into a
            // minimized window reads as "the panel is broken".
            setSize('docked');
            returnFocusRef?.current?.focus();
        }, MOTION_MS);
        return () => clearTimeout(timer);
    }, [open, returnFocusRef]);

    if (!rendered) {
        return null;
    }

    const minimized = size === 'minimized';
    const expanded = size === 'expanded';
    const placed = frame.frame !== null;
    /** True only when the panel is sitting at the expanded preset, undragged. */
    const atExpandedPreset = expanded && !placed;

    /**
     * Returns the panel to a preset size **and** to its docked corner.
     *
     * Expand and Shrink double as the way out of a bad drag: a window dragged
     * mostly off the bottom of a short screen is awkward to retrieve with the
     * same gesture that put it there, and this is the control already in the
     * header. Nothing else clears the placement, so it survives close/reopen
     * and reload — which is the point of being able to move it at all.
     */
    const preset = (next: PanelSize) => {
        frame.reset();
        setSize(next);
    };

    return (
        <div
            role="dialog"
            // Deliberately no `aria-modal`: it defaults to false, which is
            // exactly right here. Setting it true would tell a screen reader
            // the rest of the page is inert when it isn't.
            aria-label={intl.formatMessage(messages.title)}
            onKeyDown={onKeyDown}
            ref={frame.ref}
            // Only once the user has placed it. Until then the classes below
            // own the geometry, so the panel opens correctly on a viewport it
            // has never been opened in — and `left`/`top` from a previous,
            // larger monitor can never strand it off-screen.
            style={
                placed
                    ? minimized
                        ? // A minimized window is its title bar: it keeps where
                          // it is and how wide it is, and lets the header set
                          // the height.
                          { ...frame.style, height: undefined }
                        : frame.style
                    : undefined
            }
            className={cn(
                // `text-foreground` is stated rather than inherited: the panel
                // paints its own surface, so it must own the colour that goes
                // on it. Inheriting is what produced near-white text on white
                // when this rendered inside the dark sidebar's subtree.
                'bg-background text-foreground fixed z-50 flex flex-col',
                'rounded-lg border shadow-lg',
                !placed && 'right-4 bottom-4',
                // Never taller or wider than the viewport allows, so the panel
                // stays usable on a laptop screen and on a short window. A
                // placed panel is clamped to the viewport in the frame itself,
                // and these would fight that clamp rather than back it up.
                !placed && 'max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)]',
                !placed && minimized && 'w-[380px]',
                !placed && !minimized && !expanded && 'h-[620px] w-[420px]',
                !placed &&
                    expanded &&
                    'h-[calc(100vh-2rem)] w-[min(820px,calc(100vw-2rem))]',
                // Text selection is suppressed for the whole panel while a
                // gesture runs, rather than the drag calling `preventDefault()`
                // — which would also swallow the focus a mousedown gives the
                // resize handle, and that focus is what makes it keyboard
                // operable.
                frame.interacting && 'select-none',
                // A **transition**, not an `animate-in` utility: those come from
                // tailwindcss-animate, which this workspace deliberately does
                // not install — the classes shadcn ships generate no CSS here
                // (see the note atop the design system's styles.css). A
                // transition is also the safer primitive: with motion disabled
                // the element simply lands on its visible state, where a
                // keyframe animation could leave it stuck invisible.
                // `translate` and `scale`, NOT `transform`: Tailwind v4 emits
                // those as standalone CSS properties rather than folding them
                // into the `transform` shorthand, so transitioning `transform`
                // fades the opacity while the movement snaps.
                'origin-bottom-right transition-[opacity,translate,scale] duration-200 ease-out',
                'motion-reduce:transition-none',
                visible
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'translate-y-2 scale-95 opacity-0'
            )}
        >
            {/* Not while minimized: there is no body left to resize, and the
                strips would be grab targets on a bar the user just collapsed. */}
            {!minimized && <PanelResizeHandles controls={frame} />}

            <header
                className="flex shrink-0 cursor-move touch-none items-center gap-1 border-b px-3 py-2 select-none"
                onPointerDown={(event) => {
                    // The header's own controls are buttons, not a grab
                    // surface — starting a drag from Close would mean the panel
                    // walks across the screen on the way to being dismissed.
                    if ((event.target as HTMLElement).closest('button')) return;
                    frame.startMove(event);
                }}
                {...frame.handleProps}
            >
                <MoveHandle controls={frame} />

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
                    // Reads its label off the *preset*, not off `size` alone: a
                    // panel the user has dragged is at no preset, so the button
                    // offers Expand — "Shrink" on a window that is currently
                    // 400px wide because someone resized it would be nonsense.
                    <IconButton
                        icon={atExpandedPreset ? Minimize2 : Maximize2}
                        label={intl.formatMessage(
                            atExpandedPreset
                                ? messages.collapse
                                : messages.expand
                        )}
                        onClick={() =>
                            preset(atExpandedPreset ? 'docked' : 'expanded')
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
                    <PanelBody
                        key={workspaceId}
                        workspaceId={workspaceId}
                        routeContext={routeContext}
                        hidden={minimized}
                    />
                ) : (
                    <p className="text-muted-foreground p-4 text-sm">
                        {intl.formatMessage(messages.description)}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * The grip at the left of the header.
 *
 * The whole header is already draggable, so this is not the pointer
 * affordance — it is the **keyboard** one, and the reason it is a `<button>`
 * rather than a decorative icon. A window a mouse user can move and a keyboard
 * user cannot is a window whose position is a mouse-only setting; arrow keys
 * move it, `Shift` moves it faster, and the header's Expand button puts it
 * back.
 *
 * It doubles as the visual cue that the header is grabbable, which the cursor
 * alone only tells you after you have already hovered it.
 */
function MoveHandle({ controls }: { controls: PanelFrameControls }) {
    const intl = useIntl();
    return (
        <button
            type="button"
            aria-label={intl.formatMessage(messages.move)}
            title={intl.formatMessage(messages.moveHint)}
            className="text-muted-foreground focus-visible:ring-ring -ml-1 shrink-0 cursor-move touch-none rounded p-0.5 focus-visible:ring-2 focus-visible:outline-none"
            onPointerDown={(event) => controls.startMove(event)}
            onKeyDown={(event) => {
                const arrow = ARROWS[event.key];
                if (!arrow) return;
                // Or the page behind this non-modal panel scrolls under the
                // window being moved across it.
                event.preventDefault();
                const step = keyboardStep(event);
                controls.nudgeMove(arrow[0] * step, arrow[1] * step);
            }}
            {...controls.handleProps}
        >
            <GripVertical className="size-4" />
        </button>
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

function PanelBody({
    workspaceId,
    routeContext,
    hidden
}: {
    workspaceId: string;
    routeContext: RouteContext;
    hidden: boolean;
}) {
    const intl = useIntl();
    const chat = useCopilotChat(workspaceId, hidden);
    const composerRef = useRef<HTMLTextAreaElement>(null);
    // Opt-in, and a snapshot rather than a live mirror of the URL: an attached
    // context should not silently change under the user as they navigate.
    const [attached, setAttached] = useState<RouteContext | null>(null);
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

            {/* "Your message, plus where you are" (design §2) — but only when
                the user asked for it. See ContextChip for why this is opt-in. */}
            <ContextChip
                current={routeContext}
                attached={attached}
                onAttach={() => setAttached(routeContext)}
                onDetach={() => setAttached(null)}
            />

            <Composer
                busy={chat.busy}
                inputRef={composerRef}
                onSend={(text) =>
                    chat.send(
                        text,
                        {
                            // Nothing attached means a plain chat turn — the
                            // model is told where the user is only when they
                            // said so.
                            surface: attached?.surface ?? 'chat',
                            ...(attached?.contentType
                                ? { contentType: attached.contentType }
                                : {}),
                            ...(attached?.entryId
                                ? { entryId: attached.entryId }
                                : {}),
                            ...(attached?.locale
                                ? { locale: attached.locale }
                                : {})
                        },
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
