import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import {
    Button,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    WizardStepCard
} from '@ortha-cms/design-system';
import { InviteLinkPanel } from '../InviteLinkPanel';

/** Intl descriptors for {@link InviteSent}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.inviteSent.title',
        defaultMessage: 'Invite created for {email}'
    },
    description: {
        id: 'users.inviteSent.description',
        defaultMessage:
            'Their account exists but is dormant until they accept. Nothing was emailed — this install has no mail server yet — so pass the link below to them yourself.'
    },
    nextTitle: {
        id: 'users.inviteSent.nextTitle',
        defaultMessage: 'What happens when they open it'
    },
    nextOpen: {
        id: 'users.inviteSent.nextOpen',
        defaultMessage:
            'They land on a page that already knows their name and email — the only thing they choose is a password.'
    },
    nextRole: {
        id: 'users.inviteSent.nextRole',
        defaultMessage:
            'Their account activates with the {role} role and the workspace access you picked. Nothing they type can change either.'
    },
    nextSignedIn: {
        id: 'users.inviteSent.nextSignedIn',
        defaultMessage:
            'They’re signed in immediately, and the link stops working. If it expires first, resend the invite from their row.'
    },
    backToMembers: {
        id: 'users.inviteSent.backToMembers',
        defaultMessage: 'Back to members'
    }
});

/** Props for {@link InviteSent}. */
type InviteSentProps = {
    /** The invitee's email. */
    email: string;
    /** The invite link to hand over. */
    link: string;
    /** Human-readable label of the role granted on acceptance. */
    roleLabel: string;
};

/**
 * The invite wizard's final step: the invite exists, and here is the link.
 *
 * It is a step rather than a toast-then-redirect because the link is shown
 * **once** — the server keeps only its hash, so navigating away before copying
 * it means resending the invite. The copy spells out what the invitee will see,
 * since the admin can't preview the page they're sending someone to.
 */
export function InviteSent({ email, link, roleLabel }: InviteSentProps) {
    const intl = useIntl();

    return (
        <WizardStepCard>
            <CardHeader>
                {/* A real `h2`: the page's `h1` is the step name, and the
                    "what happens next" list below is an `h3` — without this the
                    outline would jump a level. */}
                <CardTitle asChild className="flex items-center gap-2">
                    <h2>
                        <CircleCheck
                            aria-hidden
                            className="size-5 shrink-0 text-success-soft-foreground"
                        />
                        {intl.formatMessage(messages.title, { email })}
                    </h2>
                </CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-8">
                <InviteLinkPanel link={link} email={email} />

                <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium">
                        {intl.formatMessage(messages.nextTitle)}
                    </h3>
                    <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
                        <li>{intl.formatMessage(messages.nextOpen)}</li>
                        <li>
                            {intl.formatMessage(messages.nextRole, {
                                role: roleLabel
                            })}
                        </li>
                        <li>{intl.formatMessage(messages.nextSignedIn)}</li>
                    </ul>
                </div>

                <Button asChild className="self-start">
                    <Link to="/users">
                        {intl.formatMessage(messages.backToMembers)}
                    </Link>
                </Button>
            </CardContent>
        </WizardStepCard>
    );
}
