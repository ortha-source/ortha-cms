import { useEffect, useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Clock, ShieldQuestion, X } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Spinner
} from '@orthacms/design-system';
import type { ToolPermissionDecision } from '@orthacms/copilot-domain';
import type { ChatPermissionRequest } from '../../domain/types/chat';

const messages = defineMessages({
    asks: {
        id: 'copilot.permission.asks',
        defaultMessage: 'Ortha AI wants to change your content'
    },
    deciding: {
        id: 'copilot.permission.deciding',
        defaultMessage: 'Sending your answer…'
    },
    nothingYet: {
        id: 'copilot.permission.nothingYet',
        defaultMessage: 'Nothing has happened yet — it is waiting for you.'
    },
    once: {
        id: 'copilot.permission.once',
        defaultMessage: 'Allow once'
    },
    chat: {
        id: 'copilot.permission.chat',
        defaultMessage: 'Allow for this chat'
    },
    deny: {
        id: 'copilot.permission.deny',
        defaultMessage: 'Don’t allow'
    },
    failed: {
        id: 'copilot.permission.failed',
        defaultMessage:
            'That answer did not reach the run — it may have already moved on.'
    },
    // The time limit, said out loud. It used to be invisible: the prompt showed
    // no time at all and simply vanished when the broker gave up (`ORT-118`).
    remaining: {
        id: 'copilot.permission.remaining',
        defaultMessage:
            'Waiting {minutes, plural, =0 {} one {# minute } other {# minutes }}{seconds, plural, one {# second} other {# seconds}} more for your answer.'
    },
    expiringSoon: {
        id: 'copilot.permission.expiringSoon',
        defaultMessage:
            'This request expires in {seconds, plural, one {# second} other {# seconds}}. Choose an answer, or ask for more time.'
    },
    expired: {
        id: 'copilot.permission.expired',
        defaultMessage:
            'Time ran out, so nothing was run. Ask again if you still want this change.'
    },
    moreTime: {
        id: 'copilot.permission.moreTime',
        defaultMessage: 'I need more time'
    }
});

/**
 * How long before the deadline the countdown turns into an assertive warning.
 *
 * WCAG 2.2.1 requires **at least twenty seconds'** notice before a
 * content-imposed limit expires, and that the user be able to extend it with a
 * simple action. Twenty exactly is the floor; this is the floor.
 */
const WARN_AT_MS = 20_000;

/**
 * The in-the-moment "may I?" — **the gate ADR-0009 left owing.**
 *
 * ADR-0009 removed the approval step and accepted, in writing, that a prompt
 * injection would then write. This is what closes that: the run is parked
 * *before* the call executes, so a tool the model was talked into by poisoned
 * content never runs at all. The old boundary asked about a change already
 * computed; this asks before anything happens.
 *
 * **"Allow for this chat" is why this is not the settings page again.** The
 * whole failure of the deleted policy screen was that escaping the ceremony
 * meant navigating somewhere and configuring it in advance. Here the escape is
 * the second button, in the prompt, at the moment you already have the context
 * to decide. There is deliberately no "always" — that would be a standing
 * permission outliving the thread it was granted in, which is the shape we just
 * removed.
 *
 * It renders **in the transcript**, not as a modal. The panel is non-modal on
 * purpose (you act on answers while reading them), and a dialog demanding an
 * answer would block the very page you need to look at to decide — often the
 * entry the change is about.
 */
export function PermissionPrompt({
    request,
    onDecide,
    onExtend
}: {
    request: ChatPermissionRequest;
    onDecide(decision: ToolPermissionDecision): void;
    /** Asks the run for more time. Omitted, the extension control is not shown. */
    onExtend?(): void;
}) {
    const intl = useIntl();
    const busy = request.deciding === true;
    const remainingMs = useRemainingMs(request.expiresAt);
    const primaryRef = useRef<HTMLButtonElement>(null);
    const describedById = useId();

    // **Move focus here when the prompt appears.** This is the one control that
    // stops a prompt-injected write before anything happens (ADR-0009 §1b), and
    // it was reachable only by tabbing *backwards* from the composer, past the
    // model picker and the paperclip, into a scroller that is still moving —
    // while its only announcement path was the transcript's `role="log"`, which
    // is saturated by the answer that is still streaming. A decision the user
    // cannot find is a decision that gets answered blind or not at all.
    //
    // The panel stays non-modal: nothing is trapped, and Tab still leaves. This
    // is focus *placement*, which is what a decision the run is blocked on
    // warrants.
    useEffect(() => {
        primaryRef.current?.focus();
    }, []);

    return (
        <section
            className="border-border bg-card rounded-lg border shadow-sm"
            // `group` rather than a bare region: the buttons and the arguments
            // they are about are one thing, and `aria-describedby` ties the
            // decision to the payload it is a decision about.
            role="group"
            aria-label={intl.formatMessage(messages.asks)}
            aria-describedby={describedById}
        >
            <header className="flex items-start gap-2 px-3 pt-3">
                <ShieldQuestion
                    aria-hidden
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                        {intl.formatMessage(messages.asks)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-[11px]">
                        {request.name}
                    </p>
                </div>
            </header>

            {/* The arguments, as **text**. This is the one screen where a user
                decides whether a write may happen, so what they are shown must
                be impossible to render as anything but characters — same rule
                as the tool step's payload, for a stronger reason. */}
            <pre
                id={describedById}
                // Keyboard-reachable because it scrolls: a decision whose
                // arguments a keyboard-only user cannot scroll through is one
                // they have to make on the visible half (2.1.1).
                tabIndex={0}
                className="text-muted-foreground focus-visible:ring-ring mt-2 max-h-40 overflow-auto px-3 text-[11px] break-words whitespace-pre-wrap focus-visible:ring-2 focus-visible:outline-none"
            >
                {stringify(request.input)}
            </pre>

            {request.error && (
                <div className="px-3 pt-3">
                    <Alert variant="destructive">
                        <AlertDescription>
                            {intl.formatMessage(messages.failed)}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {/* The countdown, and — inside the last twenty seconds — the
                warning WCAG 2.2.1 asks for. Two regions rather than one because
                they are different urgencies: the running countdown is polite
                and must not interrupt, while the warning is the user's last
                chance to act and is assertive. Only one is ever mounted, so
                they cannot both speak. */}
            {remainingMs !== null && (
                <div className="px-3 pt-2">
                    {remainingMs <= 0 ? (
                        <p
                            role="status"
                            className="text-muted-foreground text-[11px]"
                        >
                            {intl.formatMessage(messages.expired)}
                        </p>
                    ) : remainingMs <= WARN_AT_MS ? (
                        <p
                            role="alert"
                            className="text-destructive flex items-center gap-1.5 text-[11px]"
                        >
                            <Clock aria-hidden className="size-3.5 shrink-0" />
                            {intl.formatMessage(messages.expiringSoon, {
                                seconds: Math.ceil(remainingMs / 1000)
                            })}
                        </p>
                    ) : (
                        <p
                            role="status"
                            className="text-muted-foreground flex items-center gap-1.5 text-[11px]"
                        >
                            <Clock aria-hidden className="size-3.5 shrink-0" />
                            {intl.formatMessage(messages.remaining, {
                                minutes: Math.floor(remainingMs / 60_000),
                                seconds: Math.ceil(
                                    (remainingMs % 60_000) / 1000
                                )
                            })}
                        </p>
                    )}
                </div>
            )}

            <footer className="mt-3 flex flex-wrap items-center gap-2 border-t px-3 py-2">
                <span className="text-muted-foreground mr-auto text-[11px]">
                    {intl.formatMessage(messages.nothingYet)}
                </span>
                {onExtend && remainingMs !== null && remainingMs > 0 && (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={onExtend}
                    >
                        <Clock aria-hidden className="size-3.5" />
                        {intl.formatMessage(messages.moreTime)}
                    </Button>
                )}
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide('deny')}
                >
                    <X aria-hidden className="size-3.5" />
                    {intl.formatMessage(messages.deny)}
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onDecide('chat')}
                >
                    {intl.formatMessage(messages.chat)}
                </Button>
                <Button
                    ref={primaryRef}
                    size="sm"
                    disabled={busy}
                    onClick={() => onDecide('once')}
                >
                    {busy ? (
                        <>
                            <Spinner
                                aria-hidden
                                role="presentation"
                                className="size-3.5 motion-reduce:animate-none"
                            />
                            {/* Clicking disables all three buttons and swaps
                                the tick for a spinner; without this a screen
                                reader announces only that the controls became
                                unavailable. */}
                            <span className="sr-only">
                                {intl.formatMessage(messages.deciding)}
                            </span>
                        </>
                    ) : (
                        <Check aria-hidden className="size-3.5" />
                    )}
                    {intl.formatMessage(messages.once)}
                </Button>
            </footer>
        </section>
    );
}

/** The arguments as a person reads them. */
function stringify(value: unknown): string {
    try {
        return JSON.stringify(value, null, 2) ?? '';
    } catch {
        return String(value);
    }
}

/**
 * Milliseconds left until `expiresAt`, ticking once a second — or `null` when
 * the run did not say (an older server, or a replayed transcript).
 *
 * Ticks on a **one-second** interval rather than an animation frame: the number
 * on screen changes once a second, and the polite live region beside it should
 * not be re-rendered sixty times for each of those. Clamped at zero so a prompt
 * left open past its deadline reads "time ran out" instead of counting into
 * negative numbers.
 */
function useRemainingMs(expiresAt: string | undefined): number | null {
    const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const valid = Number.isFinite(deadline);

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!valid) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [valid, deadline]);

    if (!valid) return null;
    return Math.max(0, deadline - now);
}
