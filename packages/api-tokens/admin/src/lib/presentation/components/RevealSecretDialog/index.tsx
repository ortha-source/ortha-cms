import { useEffect, useId, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    toast
} from '@orthacms/design-system';
import type { CreatedApiToken } from '../../../domain/types/apiToken';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';

const messages = defineMessages({
    title: {
        id: 'apiTokens.reveal.title',
        defaultMessage: 'Copy your token now'
    },
    description: {
        id: 'apiTokens.reveal.description',
        defaultMessage:
            'This is the only time it is shown. Store it like a password.'
    },
    secretLabel: {
        id: 'apiTokens.reveal.secretLabel',
        defaultMessage: 'API token secret'
    },
    copy: {
        id: 'apiTokens.reveal.copy',
        defaultMessage: 'Copy'
    },
    copiedLabel: {
        id: 'apiTokens.reveal.copiedLabel',
        defaultMessage: 'Copied'
    },
    copied: {
        id: 'apiTokens.reveal.copied',
        defaultMessage: 'Copied to clipboard'
    },
    copyFailed: {
        id: 'apiTokens.reveal.copyFailed',
        defaultMessage:
            'Couldn’t reach the clipboard. Select the token above and copy it manually.'
    },
    tryIt: {
        id: 'apiTokens.reveal.tryIt',
        defaultMessage: 'Try it'
    },
    copyRequest: {
        id: 'apiTokens.reveal.copyRequest',
        defaultMessage: 'Copy request'
    },
    requestCopied: {
        id: 'apiTokens.reveal.requestCopied',
        defaultMessage: 'Request copied, token included'
    },
    lost: {
        id: 'apiTokens.reveal.lost',
        defaultMessage:
            'Lost it? Revoke this token and create a new one — it can’t be shown again.'
    },
    scopeRead: {
        id: 'apiTokens.reveal.scopeRead',
        defaultMessage: 'Read-only'
    },
    scopeFull: {
        id: 'apiTokens.reveal.scopeFull',
        defaultMessage: 'Full access'
    },
    expires: {
        id: 'apiTokens.reveal.expires',
        defaultMessage: 'expires {date}'
    },
    neverExpires: {
        id: 'apiTokens.reveal.neverExpires',
        defaultMessage: 'never expires'
    },
    done: {
        id: 'apiTokens.reveal.done',
        defaultMessage: 'Done'
    },
    uncopied: {
        id: 'apiTokens.reveal.uncopied',
        defaultMessage:
            'You haven’t copied the token yet, and it can’t be shown again. Closing now means minting a replacement.'
    },
    closeAnyway: {
        id: 'apiTokens.reveal.closeAnyway',
        defaultMessage: 'Close without copying'
    },
    keepOpen: {
        id: 'apiTokens.reveal.keepOpen',
        defaultMessage: 'Keep it open'
    }
});

/** Characters of the secret the example shows before eliding the rest. */
const SHOWN_SECRET_CHARS = 15;

/**
 * The ready-to-run request for a fresh token: list the content types it can
 * read, with both headers. `X-Workspace-Id` is the part people miss — it is
 * optional only for a single-workspace token, so the example always sends it
 * (naming the token's first workspace) rather than teach a habit that breaks
 * the day the token gains a second one.
 *
 * `/api/v1/content-types` is the one public read that needs no type name, so
 * the command works as pasted on any install.
 */
export function exampleRequest({
    origin,
    secret,
    workspaceId
}: {
    origin: string;
    secret: string;
    workspaceId: string | undefined;
}): string {
    const lines = [
        `curl ${origin}/api/v1/content-types`,
        `  -H "Authorization: Bearer ${secret}"`
    ];
    if (workspaceId) {
        lines.push(`  -H "X-Workspace-Id: ${workspaceId}"`);
    }
    return lines.join(' \\\n');
}

/** The origin the admin (and its same-origin API) is served from. */
function currentOrigin(): string {
    return typeof window === 'undefined' ? '' : window.location.origin;
}

/**
 * Shows a freshly minted token's plaintext **once**, with a request that uses
 * it. The token lives only in the parent's state until the dialog is
 * dismissed; it is never re-fetchable, so this is the single chance to copy it.
 *
 * Because of that, three things are load-bearing rather than decorative, and all
 * three mirror the equivalent one-time invite link in `users/admin`
 * (`InviteLinkPanel` / `InviteLinkDialog`):
 *
 * - the secret is a focusable, labelled `readOnly` field that selects itself on
 *   focus, so a keyboard or screen-reader user can read and copy it **without**
 *   the Copy button;
 * - the clipboard write is wrapped, because `navigator.clipboard.writeText`
 *   rejects on an insecure origin, a denied permission, or an unfocused
 *   document — and a silent rejection loses the credential outright;
 * - dismissing before copying asks first, since Esc, the overlay and the close
 *   button all reach `onOpenChange(false)` by reflex. Copying the example
 *   request counts as copying: it carries the whole secret.
 *
 * The example shows the secret elided (the field above is where it is read);
 * its Copy request button copies the full command.
 */
export function RevealSecretDialog({
    token,
    open,
    onOpenChange,
    resolveWorkspace
}: {
    /** The minted token with its plaintext, or `null` when nothing to reveal. */
    token: CreatedApiToken | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The workspace behind an id, for the summary line. */
    resolveWorkspace: (id: string) => WorkspaceOption | undefined;
}) {
    const intl = useIntl();
    const tryItId = useId();
    const [copied, setCopied] = useState(false);
    const [confirmingClose, setConfirmingClose] = useState(false);
    const secret = token?.secret ?? null;

    // A new secret is a new chance to lose it — clear the guard whenever one
    // arrives, so a second mint doesn't inherit the first one's "copied".
    useEffect(() => {
        if (secret !== null) {
            setCopied(false);
            setConfirmingClose(false);
        }
    }, [secret]);

    const writeClipboard = async (text: string, success: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setConfirmingClose(false);
            toast.success(success);
        } catch {
            // Clipboard access can be refused (insecure origin, denied
            // permission, unfocused document). The secret is selectable in the
            // field above, so say so rather than failing silently — this is the
            // only copy of the credential.
            toast.error(intl.formatMessage(messages.copyFailed));
        }
    };

    const workspaceId = token?.workspaceIds[0];
    const origin = currentOrigin();
    const request = secret
        ? exampleRequest({ origin, secret, workspaceId })
        : '';
    const shownRequest = secret
        ? exampleRequest({
              origin,
              secret: `${secret.slice(0, SHOWN_SECRET_CHARS)}…`,
              workspaceId
          })
        : '';

    /** Close for real, clearing the guard. */
    const close = () => {
        setConfirmingClose(false);
        onOpenChange(false);
    };

    /** Every dismissal path funnels through here so none of them can slip past. */
    const requestClose = () => {
        if (copied) {
            close();
            return;
        }
        setConfirmingClose(true);
    };

    const summary = token
        ? [
              token.name,
              intl.formatMessage(
                  token.scope === 'full'
                      ? messages.scopeFull
                      : messages.scopeRead
              ),
              token.workspaceIds
                  .map((id) => resolveWorkspace(id)?.name ?? id)
                  .join(', '),
              token.expiresAt
                  ? intl.formatMessage(messages.expires, {
                        date: intl.formatDate(token.expiresAt, {
                            month: 'short',
                            day: 'numeric'
                        })
                    })
                  : intl.formatMessage(messages.neverExpires)
          ].join(' · ')
        : '';

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    onOpenChange(true);
                    return;
                }
                requestClose();
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[580px]">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                {/* `min-w-0` on the row is load-bearing: `DialogContent` is a
                    grid, whose items default to `min-width: auto`, so without it
                    the unbreakable token string widens this row past the
                    dialog and the copy button lands outside the panel. The
                    secret is longer than the field is wide, so it wraps onto
                    a second line (`break-all`) rather than scrolling sideways:
                    the whole credential stays readable at once. On a phone the
                    Copy button sits under the field at full width; from `sm`
                    up it sits beside it, `shrink-0` so the field — not the
                    control — gives up the space. */}
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start">
                    <textarea
                        readOnly
                        rows={2}
                        value={secret ?? ''}
                        aria-label={intl.formatMessage(messages.secretLabel)}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 resize-none overflow-hidden break-all rounded-lg border border-dashed bg-muted/40 px-3 py-2 font-mono text-[13px] leading-5 outline-none [field-sizing:content] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className={
                            copied
                                ? 'w-full shrink-0 text-success-soft-foreground sm:w-auto'
                                : 'w-full shrink-0 sm:w-auto'
                        }
                        onClick={() =>
                            secret
                                ? writeClipboard(
                                      secret,
                                      intl.formatMessage(messages.copied)
                                  )
                                : undefined
                        }
                    >
                        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                        {intl.formatMessage(
                            copied ? messages.copiedLabel : messages.copy
                        )}
                    </Button>
                </div>

                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span id={tryItId} className="text-sm font-medium">
                            {intl.formatMessage(messages.tryIt)}
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 px-2 text-xs"
                            onClick={() =>
                                request
                                    ? writeClipboard(
                                          request,
                                          intl.formatMessage(
                                              messages.requestCopied
                                          )
                                      )
                                    : undefined
                            }
                        >
                            <Copy aria-hidden className="size-3.5" />
                            {intl.formatMessage(messages.copyRequest)}
                        </Button>
                    </div>
                    {/* A focusable, named group. Long lines (a real origin, a
                        uuid workspace id) wrap instead of scrolling sideways,
                        so the dialog never grows a horizontal scrollbar. */}
                    <pre
                        role="group"
                        aria-labelledby={tryItId}
                        tabIndex={0}
                        className="min-w-0 whitespace-pre-wrap break-all rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <code>{shownRequest}</code>
                    </pre>
                </div>

                <Alert variant="warning" role="note">
                    <TriangleAlert aria-hidden />
                    <AlertDescription>
                        {intl.formatMessage(messages.lost)}
                    </AlertDescription>
                </Alert>

                {confirmingClose ? (
                    <Alert variant="destructive" role="alert">
                        <TriangleAlert aria-hidden />
                        <AlertDescription>
                            {intl.formatMessage(messages.uncopied)}
                        </AlertDescription>
                    </Alert>
                ) : null}

                <DialogFooter className="items-center gap-2 border-t pt-4 sm:justify-between">
                    <p className="min-w-0 max-w-full text-center text-xs text-muted-foreground sm:truncate sm:text-left">
                        {summary}
                    </p>
                    <div className="flex shrink-0 justify-end gap-2">
                        {confirmingClose ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmingClose(false)}
                                >
                                    {intl.formatMessage(messages.keepOpen)}
                                </Button>
                                <Button variant="destructive" onClick={close}>
                                    {intl.formatMessage(messages.closeAnyway)}
                                </Button>
                            </>
                        ) : (
                            <Button onClick={requestClose}>
                                {intl.formatMessage(messages.done)}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
