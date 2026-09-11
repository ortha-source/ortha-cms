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
    Textarea
} from '@orthacms/design-system';
import type { PublishOutlook } from '../../../domain/types';

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
 * **It does not publish.** Confirming hands the reason to `onConfirm` and
 * closes; the publish itself is the editor's own, run through
 * `ENTRY_PUBLISH_GUARD_SLOT`'s callback — which is what saves the edits on
 * screen first, creates the record on a create form, and puts up the same busy
 * cover and toasts an ordinary publish gets. A publish of its own from here
 * would ship the stored record and silently drop whatever was being edited.
 *
 * Focus trap and focus return to the trigger come from the Radix `Dialog`;
 * the field is labelled through `Field`/`FieldLabel` rather than a placeholder,
 * which is not a label.
 */
export function BypassDialog({
    open,
    onOpenChange,
    outlook,
    onConfirm,
    returnFocusTo
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The verdict being bypassed — its numbers are what the body states. */
    outlook: PublishOutlook;
    /** Publish with this reason. Called with the trimmed, non-empty reason. */
    onConfirm: (reason: string) => void;
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
        const confirmed = reason.trim();
        // Closed first: the publish puts the editor's busy cover up, and a
        // dialog left open above it would be one more layer over the result.
        close();
        onConfirm(confirmed);
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
                            required: outlook.required,
                            given: outlook.given
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
                    <Button type="button" variant="outline" onClick={close}>
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={submit}
                    >
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
