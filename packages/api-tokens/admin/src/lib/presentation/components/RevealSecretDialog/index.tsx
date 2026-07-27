import { useState } from 'react';
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
} from '@ortha-cms/design-system';

const messages = defineMessages({
    title: {
        id: 'apiTokens.reveal.title',
        defaultMessage: 'Copy your API token'
    },
    description: {
        id: 'apiTokens.reveal.description',
        defaultMessage:
            'This is the only time the token is shown. Store it somewhere safe — you won’t be able to see it again.'
    },
    warning: {
        id: 'apiTokens.reveal.warning',
        defaultMessage:
            'Treat this token like a password. Anyone with it can read this workspace’s content.'
    },
    copy: {
        id: 'apiTokens.reveal.copy',
        defaultMessage: 'Copy'
    },
    copied: {
        id: 'apiTokens.reveal.copied',
        defaultMessage: 'Copied to clipboard'
    },
    done: {
        id: 'apiTokens.reveal.done',
        defaultMessage: 'Done'
    }
});

/**
 * Shows a freshly minted token's plaintext **once**. The secret lives only in
 * the parent's state until the dialog is dismissed; it is never re-fetchable, so
 * this is the single chance to copy it.
 */
export function RevealSecretDialog({
    secret,
    open,
    onOpenChange
}: {
    /** The plaintext token, or `null` when there is nothing to reveal. */
    secret: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const intl = useIntl();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        if (!secret) {
            return;
        }
        await navigator.clipboard.writeText(secret);
        setCopied(true);
        toast.success(intl.formatMessage(messages.copied));
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setCopied(false);
                }
                onOpenChange(next);
            }}
        >
            <DialogContent>
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
                    dialog's `max-w-lg` and the copy button lands outside the
                    panel. With it the row can shrink and the `truncate` below
                    takes effect. The button is `shrink-0` so the code block —
                    not the control — gives up the space. */}
                <div className="flex min-w-0 items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">
                        {secret}
                    </code>
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={copy}
                        aria-label={intl.formatMessage(messages.copy)}
                    >
                        {copied ? <Check /> : <Copy />}
                        {intl.formatMessage(messages.copy)}
                    </Button>
                </div>

                <Alert>
                    <TriangleAlert aria-hidden />
                    <AlertDescription>
                        {intl.formatMessage(messages.warning)}
                    </AlertDescription>
                </Alert>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>
                        {intl.formatMessage(messages.done)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
