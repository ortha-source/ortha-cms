import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@ortha-cms/design-system';
import { InviteLinkPanel } from '../InviteLinkPanel';

/** Intl descriptors for {@link InviteLinkDialog}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.inviteLinkDialog.title',
        defaultMessage: 'Send this link to {email}'
    },
    description: {
        id: 'users.inviteLinkDialog.description',
        defaultMessage:
            'The previous invite link stopped working the moment this one was created, so this is the link they need. It’s shown once — copy it before you close this.'
    },
    done: {
        id: 'users.inviteLinkDialog.done',
        defaultMessage: 'Done'
    }
});

/** Props for {@link InviteLinkDialog}. */
type InviteLinkDialogProps = {
    /** The freshly rotated invite link, or `null` when there is none to show. */
    link: string | null;
    /** Who the link is for. */
    email: string;
    /** Whether the dialog is open. */
    open: boolean;
    /** Called when the dialog opens or closes. */
    onOpenChange: (open: boolean) => void;
};

/**
 * Shows the invite link produced by a **resend**. Resending rotates the token,
 * which kills the link the invitee may already be holding — so handing the new
 * one over is not a nicety, it is the rest of the operation.
 */
export function InviteLinkDialog({
    link,
    email,
    open,
    onOpenChange
}: InviteLinkDialogProps) {
    const intl = useIntl();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, { email })}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                {link && <InviteLinkPanel link={link} email={email} />}

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>
                        {intl.formatMessage(messages.done)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
