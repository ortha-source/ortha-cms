import { useEffect, useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Clock, TriangleAlert } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Spinner
} from '@orthacms/design-system';
import type { ToolPermissionDecision } from '@orthacms/copilot-domain';
import type { ChatPermissionRequest } from '../../domain/types/chat';
import { ChangeCard } from '../ChangeCard';
import { permissionCopy } from './permissionCopy';

const messages = defineMessages({
    deciding: {
        id: 'copilot.permission.deciding',
        defaultMessage: 'Sending your answer…'
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
    details: {
        id: 'copilot.permission.details',
        defaultMessage: 'What it will send'
    },
    failed: {
        id: 'copilot.permission.failed',
        defaultMessage:
            'That answer did not reach the run — it may have already moved on.'
    },
    // The only thing left to say about time. The countdown, the twenty-second
    // warning and the "I need more time" button are gone (`ORT-199`) — see the
    // keep-alive below for why removing them is allowed. This one stays,
    // because a prompt that *did* run out has to say so rather than sit there
    // looking answerable.
    expired: {
        id: 'copilot.permission.expired',
        defaultMessage:
            'Time ran out, so nothing was run. Ask again if you still want this change.'
    }
});

/**
 * How often an open prompt asks the run for more time.
 *
 * **This is what lets the prompt show no clock at all.** WCAG 2.2.1 governs a
 * time limit the *content* imposes on the user, and offers several ways out —
 * the one this component used was "extendable by a simple action", which is
 * what the countdown, the twenty-second warning and the "I need more time"
 * button were. Removing that button on its own would have left a limit the user
 * is shown, is hurried by, and cannot extend: a failure of the criterion rather
 * than a tidy-up. Extending it from here instead removes the limit from the
 * user's experience entirely, which is the exception the criterion opens with.
 *
 * The server's budget is five minutes per run
 * (`DEFAULT_RUN_DECISION_BUDGET_MS`) and one extension grants a fresh one, so
 * two minutes is comfortably inside it without being a stream of requests.
 *
 * A **hidden tab does not extend**. Nobody is reading it, and the run is
 * holding a connection, a generator and the model's context open while it
 * waits — so a prompt left open in a background tab is the one case where the
 * budget should still be allowed to run out.
 */
const KEEPALIVE_MS = 120_000;

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
    /**
     * Asks the run for more time. No longer a control the user presses — it is
     * the keep-alive this prompt runs while it is open. Omitted, the run's
     * budget is left to expire on its own, which is what a replayed transcript
     * wants.
     */
    onExtend?(): void;
}) {
    const intl = useIntl();
    const busy = request.deciding === true;
    const remainingMs = useRemainingMs(request.expiresAt);
    const primaryRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const describedById = useId();
    const copy = permissionCopy(intl, request.preview);

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

    // **Hold the run open while this prompt is on screen.** With the countdown
    // and its extend button gone, nothing else would: the broker's budget would
    // expire under a reader who is still deciding, which is exactly the hurry
    // the removal was meant to end. See `KEEPALIVE_MS` for why this is what
    // makes removing them legitimate rather than a regression.
    //
    // No leading call: the run has just parked, so it has its full budget.
    useEffect(() => {
        if (!onExtend) return;
        const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') onExtend();
        }, KEEPALIVE_MS);
        return () => window.clearInterval(id);
    }, [onExtend]);

    return (
        <>
            {/* **The change, before it is made** (R7: "the result is a change
                card with Was → Now per record, marked Not saved"). Computed by
                the server from a tool that declared a pure handler; when there
                is none, the arguments below stand in for it. */}
            {request.preview ? (
                <ChangeCard
                    summary={request.preview.summary}
                    changes={request.preview.changes}
                    records={request.preview.records}
                    omitted={request.preview.omitted}
                    status="preview"
                />
            ) : null}

            <section
                className="border-warning/45 bg-warning-soft/55 flex flex-col gap-2.5 rounded-xl border px-3.5 py-3 text-[13px]"
                // `group` rather than a bare region: the buttons and the
                // sentence they answer are one thing, and `aria-describedby`
                // ties the decision to what it is a decision about.
                role="group"
                aria-labelledby={titleId}
                aria-describedby={describedById}
            >
                <p
                    id={titleId}
                    className="flex items-center gap-2 font-semibold"
                >
                    <TriangleAlert
                        aria-hidden
                        className="text-warning-soft-foreground size-4 shrink-0"
                    />
                    {copy.title}
                </p>
                <p id={describedById}>{copy.consequence}</p>

                {/* The arguments, as **text** — this is the one screen where a
                    user decides whether a write may happen, so what they are
                    shown must be impossible to render as anything but
                    characters. Open when there is no preview to read instead,
                    one click away when there is. */}
                <details
                    open={!request.preview}
                    className="text-muted-foreground group/details"
                >
                    <summary className="focus-visible:ring-ring w-fit cursor-pointer rounded-sm text-xs focus-visible:ring-2 focus-visible:outline-none">
                        {intl.formatMessage(messages.details)}{' '}
                        <span className="font-mono">{request.name}</span>
                    </summary>
                    <pre
                        // Keyboard-reachable because it scrolls: a decision
                        // whose arguments a keyboard-only user cannot scroll
                        // through is one they make on the visible half (2.1.1).
                        tabIndex={0}
                        aria-label={intl.formatMessage(messages.details)}
                        className="bg-background/60 focus-visible:ring-ring mt-1.5 max-h-40 overflow-auto rounded-md border p-2 text-[11px] break-words whitespace-pre-wrap focus-visible:ring-2 focus-visible:outline-none"
                    >
                        {stringify(request.input)}
                    </pre>
                </details>

                {request.error && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            {intl.formatMessage(messages.failed)}
                        </AlertDescription>
                    </Alert>
                )}

                {/* The **outcome**, not a countdown. While the prompt is open
                    the keep-alive above holds the run, so there is no clock to
                    show. What is left is a prompt left in a hidden tab until
                    the budget ran out, where the buttons below would otherwise
                    look answerable and quietly do nothing. */}
                {remainingMs !== null && remainingMs <= 0 && (
                    <p
                        role="status"
                        className="text-muted-foreground flex items-center gap-1.5 text-xs"
                    >
                        <Clock aria-hidden className="size-3.5 shrink-0" />
                        {intl.formatMessage(messages.expired)}
                    </p>
                )}

                {/* In the order a person reads them (R7): the safe, one-off
                    answer first and focused, the standing one second, the
                    refusal last and quietest. */}
                <div className="flex flex-wrap items-center gap-2">
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
                                {/* Clicking disables all three buttons; without
                                    this a screen reader announces only that the
                                    controls became unavailable. */}
                                <span className="sr-only">
                                    {intl.formatMessage(messages.deciding)}
                                </span>
                            </>
                        ) : null}
                        {intl.formatMessage(messages.once)}
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
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onDecide('deny')}
                    >
                        {intl.formatMessage(messages.deny)}
                    </Button>
                </div>
            </section>
        </>
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
 * Milliseconds left until `expiresAt` — or `null` when the run did not say (an
 * older server, or a replayed transcript).
 *
 * Nothing renders the number any more: with the keep-alive holding an open
 * prompt, the only question left is whether the deadline has **passed**, which
 * is the one thing this still answers. It keeps a one-second tick rather than
 * a single timer to the deadline because a machine that slept through it would
 * never fire that timer, and the prompt would stay looking answerable.
 * Clamped at zero so an expired prompt reads "time ran out" rather than
 * counting into negative numbers.
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
