import { defineMessages, useIntl } from 'react-intl';
import { Check, ShieldQuestion, X } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Spinner
} from '@ortha-cms/design-system';
import type { ToolPermissionDecision } from '@ortha-cms/copilot-domain';
import type { ChatPermissionRequest } from '../../domain/types/chat';

const messages = defineMessages({
    asks: {
        id: 'copilot.permission.asks',
        defaultMessage: 'Ortha AI wants to change your content'
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
    }
});

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
    onDecide
}: {
    request: ChatPermissionRequest;
    onDecide(decision: ToolPermissionDecision): void;
}) {
    const intl = useIntl();
    const busy = request.deciding === true;

    return (
        <section
            className="border-border bg-card rounded-lg border shadow-sm"
            aria-label={intl.formatMessage(messages.asks)}
        >
            <header className="flex items-start gap-2 px-3 pt-3">
                <ShieldQuestion className="text-muted-foreground mt-0.5 size-4 shrink-0" />
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
            <pre className="text-muted-foreground mt-2 max-h-40 overflow-auto px-3 text-[11px] break-words whitespace-pre-wrap">
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

            <footer className="mt-3 flex flex-wrap items-center gap-2 border-t px-3 py-2">
                <span className="text-muted-foreground mr-auto text-[11px]">
                    {intl.formatMessage(messages.nothingYet)}
                </span>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide('deny')}
                >
                    <X className="size-3.5" />
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
                    size="sm"
                    disabled={busy}
                    onClick={() => onDecide('once')}
                >
                    {busy ? (
                        <Spinner className="size-3.5" />
                    ) : (
                        <Check className="size-3.5" />
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
