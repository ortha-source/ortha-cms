import { useId, useState, type RefObject } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldError,
    FieldLabel,
    Textarea,
    toast
} from '@orthacms/design-system';
import type { EntryReview } from '../../../domain/types';
import {
    useBypassPublish,
    type EntryReviewScope
} from '../../../application/hooks';

const messages = defineMessages({
    title: {
        id: 'protection.bypass.title',
        defaultMessage: 'Publish without review?'
    },
    body: {
        id: 'protection.bypass.body',
        defaultMessage:
            'This type is protected: it needs {required, plural, one {# approval} other {# approvals}}, and has {given}. You are publishing past the rule as an administrator.'
    },
    reasonLabel: {
        id: 'protection.bypass.reasonLabel',
        defaultMessage: 'Reason'
    },
    reasonPlaceholder: {
        id: 'protection.bypass.reasonPlaceholder',
        defaultMessage: 'Why is this going out without review?'
    },
    trail: {
        id: 'protection.bypass.trail',
        defaultMessage:
            'This will appear in the activity log as entry.publish_bypassed, with your name, the rule and this reason.'
    },
    required: {
        id: 'protection.bypass.required',
        defaultMessage: 'A reason is required — the log row is the point.'
    },
    cancel: { id: 'protection.bypass.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'protection.bypass.confirm',
        defaultMessage: 'Publish anyway'
    },
    done: {
        id: 'protection.bypass.done',
        defaultMessage: 'Published past the rule. The reason is in the log.'
    },
    failed: {
        id: 'protection.bypass.failed',
        defaultMessage: 'That publish did not go through.'
    }
});

/**
 * The bypass dialog.
 *
 * It belongs to this plugin and not to `content-admin` because everything it
 * says is protection's: which rule is in force, how far short the count is, and
 * what the log row will be called. Content only knows that a contribution
 * offered a way through — see `ENTRY_PUBLISH_GUARD_SLOT`.
 *
 * **The reason is mandatory, and the confirm button is not disabled.** Those
 * are the same decision, not opposite ones: a disabled control explains nothing
 * to anybody and nothing at all to a screen reader, so pressing Publish anyway
 * with an empty box refuses the publish and *says why*, through a `FieldError`
 * that announces. Without the reason, three months later the log holds twenty
 * overrides and no account of any of them — which is indistinguishable from
 * having had no rule.
 *
 * Focus trap and focus return to the trigger come from the Radix `Dialog`;
 * the field is labelled through `Field`/`FieldLabel` rather than a placeholder,
 * which is not a label.
 */
export function BypassDialog({
    open,
    onOpenChange,
    scope,
    review,
    returnFocusTo
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    scope: EntryReviewScope;
    review: EntryReview;
    /**
     * The control that opened this, so closing puts focus back on it.
     *
     * Radix restores focus to whatever it captured when the content mounted,
     * and that is not reliable here: the button belongs to `content-admin` and
     * is re-rendered as the verdict changes, so the node Radix holds can be one
     * React has already replaced — leaving focus on `<body>` and a keyboard user
     * at the top of the page.
     */
    returnFocusTo?: RefObject<HTMLElement | null>;
}) {
    const intl = useIntl();
    const reasonId = useId();
    const [reason, setReason] = useState('');
    const [touched, setTouched] = useState(false);
    const publish = useBypassPublish(scope);

    const empty = reason.trim().length === 0;
    const showError = touched && empty;

    const close = () => {
        setReason('');
        setTouched(false);
        onOpenChange(false);
    };

    const submit = () => {
        if (empty) {
            // Refuse, and say so. The button stays operable so the refusal is
            // something the person hears rather than something that silently
            // does nothing.
            setTouched(true);
            return;
        }
        publish.mutate(
            {
                typeName: scope.typeName,
                entryId: scope.entryId,
                bypassReason: reason.trim()
            },
            {
                onSuccess: () => {
                    toast.success(intl.formatMessage(messages.done));
                    close();
                },
                onError: () => toast.error(intl.formatMessage(messages.failed))
            }
        );
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? onOpenChange(true) : close())}
        >
            <DialogContent
                onCloseAutoFocus={(event) => {
                    const target = returnFocusTo?.current;
                    // Focusing a detached node silently does nothing, which is
                    // worse than letting Radix try — so only take over when the
                    // trigger is certainly still there.
                    if (target?.isConnected) {
                        event.preventDefault();
                        target.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.body, {
                            required: review.required,
                            given: review.given
                        })}
                    </DialogDescription>
                </DialogHeader>

                <Field>
                    <FieldLabel htmlFor={reasonId}>
                        {intl.formatMessage(messages.reasonLabel)}
                    </FieldLabel>
                    <Textarea
                        id={reasonId}
                        rows={3}
                        value={reason}
                        aria-invalid={showError || undefined}
                        placeholder={intl.formatMessage(
                            messages.reasonPlaceholder
                        )}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    {showError ? (
                        <FieldError>
                            {intl.formatMessage(messages.required)}
                        </FieldError>
                    ) : null}
                </Field>

                {/* Said before the click, not after it. */}
                <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(messages.trail)}
                </p>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={close}
                        disabled={publish.isPending}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={submit}
                        disabled={publish.isPending}
                    >
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
