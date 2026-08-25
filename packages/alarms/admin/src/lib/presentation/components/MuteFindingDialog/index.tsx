import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Label,
    Spinner,
    Textarea
} from '@orthacms/design-system';
import type { AlarmFinding } from '../../../types/alarm';

const messages = defineMessages({
    title: { id: 'alarms.muteDialog.title', defaultMessage: 'Mute this check' },
    description: {
        id: 'alarms.muteDialog.description',
        defaultMessage:
            '“{title}” stays muted on this record until someone unmutes it — including if the record stops matching and starts again.'
    },
    reason: {
        id: 'alarms.muteDialog.reason',
        defaultMessage: 'Why is this one fine?'
    },
    reasonHint: {
        id: 'alarms.muteDialog.reasonHint',
        defaultMessage:
            'Optional, and worth writing: it is what the next person sees instead of wondering whether the mute was a mistake.'
    },
    placeholder: {
        id: 'alarms.muteDialog.placeholder',
        defaultMessage: 'Deliberately a stub until legal sign-off.'
    },
    cancel: { id: 'alarms.muteDialog.cancel', defaultMessage: 'Cancel' },
    confirm: { id: 'alarms.muteDialog.confirm', defaultMessage: 'Mute' }
});

/** Props for {@link MuteFindingDialog}. */
export type MuteFindingDialogProps = {
    /** The finding being muted, or `null` when the dialog is closed. */
    finding: AlarmFinding | null;
    /** A mute is in flight. */
    isPending: boolean;
    /** Dismiss without muting. */
    onCancel: () => void;
    /** Mute, with the reason the user gave (empty means none). */
    onConfirm: (reason: string) => void;
};

/**
 * Asks for a mute's reason.
 *
 * This was a `window.prompt`, which is the wrong control for three separate
 * reasons and not only an ugly one: it is unstyled chrome that reads as a
 * browser error rather than part of the CMS, it blocks the whole tab so the
 * record the finding is about cannot be consulted while answering, and its
 * single line invites a three-word reason for a decision that outlives the
 * person making it. Some browsers also suppress `prompt()` outright — in a
 * background tab, or after the user ticks "prevent additional dialogs" — and
 * a suppressed prompt returns `null`, which this code could not tell apart
 * from Cancel. The mute would silently not happen.
 *
 * The reason is genuinely optional. Requiring one would buy a field full of
 * "." — muting is already a deliberate act, and the audit trail records who
 * did it either way.
 */
export function MuteFindingDialog({
    finding,
    isPending,
    onCancel,
    onConfirm
}: MuteFindingDialogProps) {
    const intl = useIntl();
    const [reason, setReason] = useState('');

    // Clear between findings: a reason typed for one record must never be
    // carried into the mute of another.
    useEffect(() => {
        if (finding) setReason('');
    }, [finding?.ruleId, finding?.entryId]);

    return (
        <Dialog
            open={finding !== null}
            onOpenChange={(next) => {
                if (!next) onCancel();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description, {
                            title: finding?.title ?? ''
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="alarms-mute-reason">
                        {intl.formatMessage(messages.reason)}
                    </Label>
                    <Textarea
                        id="alarms-mute-reason"
                        rows={3}
                        value={reason}
                        placeholder={intl.formatMessage(messages.placeholder)}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        {intl.formatMessage(messages.reasonHint)}
                    </p>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        disabled={isPending}
                        onClick={onCancel}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        disabled={isPending}
                        onClick={() => onConfirm(reason.trim())}
                    >
                        {isPending ? <Spinner /> : null}
                        {intl.formatMessage(messages.confirm)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
