import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Field,
    FieldLabel,
    Input,
    Spinner,
    cn
} from '@orthacms/design-system';
import type { InviteDetails } from '../../../../types/auth';
import { AuthAlert } from '../AuthAlert';
import { AuthCard } from '../AuthCard';
import { PasswordField } from '../PasswordField';
import { SsoProviders } from '../SsoProviders';
import { UserPlusIcon } from '../AuthIcons';
import { useAcceptInviteSchema } from './useAcceptInviteSchema';

/** Intl descriptors for {@link AcceptInviteForm}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.acceptInvite.title',
        defaultMessage: 'You’re invited to {product}'
    },
    scopeRoleAndWorkspaces: {
        id: 'identity.acceptInvite.scope.roleAndWorkspaces',
        defaultMessage:
            'as {article, select, an {an} other {a}} {role} in {workspaces}'
    },
    scopeRole: {
        id: 'identity.acceptInvite.scope.role',
        defaultMessage: 'as {article, select, an {an} other {a}} {role}'
    },
    scopeWorkspaces: {
        id: 'identity.acceptInvite.scope.workspaces',
        defaultMessage: 'in {workspaces}'
    },
    nameLabel: {
        id: 'identity.acceptInvite.nameLabel',
        defaultMessage: 'Name'
    },
    emailLabel: {
        id: 'identity.acceptInvite.emailLabel',
        defaultMessage: 'Email'
    },
    prefilledHint: {
        id: 'identity.acceptInvite.prefilledHint',
        defaultMessage:
            'Set by whoever invited you. If it looks wrong, ask them for a new invite.'
    },
    namePrefilledHint: {
        id: 'identity.acceptInvite.namePrefilledHint',
        defaultMessage:
            'Set by whoever invited you. You can change it later in your profile.'
    },
    passwordLabel: {
        id: 'identity.acceptInvite.passwordLabel',
        defaultMessage: 'Password'
    },
    submit: {
        id: 'identity.acceptInvite.submit',
        defaultMessage: 'Create my account'
    },
    submitting: {
        id: 'identity.acceptInvite.submitting',
        defaultMessage: 'Setting up your account…'
    },
    ssoSeparator: {
        id: 'identity.acceptInvite.sso.separator',
        defaultMessage: 'or'
    },
    errorTitle: {
        id: 'identity.acceptInvite.errorTitle',
        defaultMessage: 'Couldn’t finish setting up'
    }
});

/** How the product names itself on the invitation. */
const PRODUCT_NAME = 'Ortha CMS';

/** The values {@link AcceptInviteForm} submits once the schema passes. */
export type AcceptInviteFormValues = {
    /** The chosen password. */
    password: string;
};

/** Props for the {@link AcceptInviteForm} component. */
type AcceptInviteFormProps = Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
    /** What the invite is for; rendered, never collected. */
    invite: InviteDetails;
    /**
     * The raw token from the invite link. Needed here, not just by the page's
     * submit handler, because the single-sign-on buttons carry it in their
     * `href` — accepting with a work account is a full-page navigation, so the
     * token has to be part of the URL rather than of a request body.
     */
    token: string;
    /** Called when the form is submitted with valid values. */
    onSubmit?: (values: AcceptInviteFormValues) => void;
    /** Whether a submission is in flight; swaps the button for a spinner. */
    isPending?: boolean;
    /** Error message to surface in the destructive alert, if any. */
    error?: string;
};

/**
 * The invitation (R7): **what** you are invited to comes first — the role and
 * the workspaces — then who the account is for, then one password field with
 * a strength meter instead of two.
 *
 * **It never says who sent it.** The board drew the inviter's avatar and name
 * ("Ada Lovelace invited you"); this page is public and its link travels by
 * email and chat, so it says "You're invited" and names no administrator. The
 * role and the workspaces are what the token itself grants whoever redeems it,
 * so naming them tells the holder nothing the link does not.
 *
 * The name and email come from the invite and are **read-only** — not
 * `disabled`, so they stay focusable and announced, each with its reason as a
 * visually-hidden description. Letting someone edit the email on the way in
 * would let them claim an identity that was never invited.
 *
 * Presentation only: TanStack Form holds the field and `onSubmit` is the
 * page's.
 */
export function AcceptInviteForm({
    className,
    invite,
    token,
    onSubmit,
    isPending = false,
    error,
    ...props
}: AcceptInviteFormProps) {
    const intl = useIntl();
    const acceptInviteSchema = useAcceptInviteSchema();

    const form = useForm({
        defaultValues: { password: '' },
        // `onChange` validates as the user types and also runs on submit, so an
        // empty form flags the field when the button is pressed. Don't also set
        // `onSubmit` to the same schema — the error would render twice.
        validators: { onChange: acceptInviteSchema },
        onSubmit: ({ value }) => onSubmit?.(value)
    });

    const scope = inviteScope(intl, invite);

    return (
        <div className={cn('flex flex-col', className)} {...props}>
            <AuthCard
                title={intl.formatMessage(messages.title, {
                    product: PRODUCT_NAME
                })}
                header={
                    <div className="flex items-center gap-2.5">
                        <span
                            aria-hidden="true"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet-soft-foreground"
                        >
                            <UserPlusIcon />
                        </span>
                        <div className="flex min-w-0 flex-col">
                            <h1 className="text-sm font-semibold">
                                {intl.formatMessage(messages.title, {
                                    product: PRODUCT_NAME
                                })}
                            </h1>
                            {scope && (
                                <p className="text-[13px] text-muted-foreground">
                                    {scope}
                                </p>
                            )}
                        </div>
                    </div>
                }
            >
                {error && (
                    <AuthAlert
                        title={intl.formatMessage(messages.errorTitle)}
                        message={error}
                    />
                )}
                <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                >
                    <div
                        className={cn(
                            'grid gap-3',
                            invite.name && 'sm:grid-cols-2'
                        )}
                    >
                        {invite.name && (
                            <ReadOnlyField
                                id="accept-invite-name"
                                label={intl.formatMessage(messages.nameLabel)}
                                value={invite.name}
                                reason={intl.formatMessage(
                                    messages.namePrefilledHint
                                )}
                            />
                        )}
                        <ReadOnlyField
                            id="accept-invite-email"
                            type="email"
                            // `username`, so a password manager saves the new
                            // password against this address.
                            autoComplete="username"
                            label={intl.formatMessage(messages.emailLabel)}
                            value={invite.email}
                            reason={intl.formatMessage(messages.prefilledHint)}
                            muted
                        />
                    </div>

                    <form.Field name="password">
                        {(field) => {
                            const invalid =
                                field.state.meta.isTouched &&
                                field.state.meta.errors.length > 0;
                            return (
                                <PasswordField
                                    id="accept-invite-password"
                                    name={field.name}
                                    label={intl.formatMessage(
                                        messages.passwordLabel
                                    )}
                                    autoComplete="new-password"
                                    meter
                                    value={field.state.value}
                                    onChange={field.handleChange}
                                    onBlur={field.handleBlur}
                                    errors={
                                        invalid
                                            ? field.state.meta.errors
                                            : undefined
                                    }
                                />
                            );
                        }}
                    </form.Field>

                    <Button
                        type="submit"
                        className="h-9 w-full"
                        disabled={isPending}
                    >
                        {isPending ? (
                            <>
                                <Spinner aria-hidden="true" />
                                <span className="sr-only">
                                    {intl.formatMessage(messages.submitting)}
                                </span>
                            </>
                        ) : (
                            intl.formatMessage(messages.submit)
                        )}
                    </Button>
                </form>

                {/* Accepting with a work account instead of a password. The
                    server checks that the address the provider vouches for is
                    the one that was invited, and activates the account with no
                    credential — so the provider becomes the only way in, which
                    is what this button chooses. Renders nothing when no
                    provider is registered. */}
                <SsoProviders
                    inviteToken={token}
                    separatorLabel={intl.formatMessage(messages.ssoSeparator)}
                    separatorPosition="before"
                />
            </AuthCard>
        </div>
    );
}

/**
 * "as a Contributor in Marketing site and Support hub" — whichever parts of
 * it the server could say, or `null` when it said neither.
 */
function inviteScope(
    intl: ReturnType<typeof useIntl>,
    invite: InviteDetails
): string | null {
    const role = invite.role?.trim();
    const workspaces = (invite.workspaces ?? []).filter(Boolean);
    const list =
        workspaces.length > 0
            ? intl.formatList(workspaces, { type: 'conjunction' })
            : null;
    // English's article, chosen by the role's first letter; a translation is
    // free to ignore the `article` argument.
    const article = role && /^[aeiou]/i.test(role) ? 'an' : 'a';

    if (role && list) {
        return intl.formatMessage(messages.scopeRoleAndWorkspaces, {
            article,
            role,
            workspaces: list
        });
    }
    if (role) {
        return intl.formatMessage(messages.scopeRole, { article, role });
    }
    if (list) {
        return intl.formatMessage(messages.scopeWorkspaces, {
            workspaces: list
        });
    }
    return null;
}

/** Props for {@link ReadOnlyField}. */
type ReadOnlyFieldProps = {
    id: string;
    label: string;
    value: string;
    /** Why it cannot be edited — the field's visually-hidden description. */
    reason: string;
    type?: string;
    autoComplete?: React.HTMLInputAutoCompleteAttribute;
    /** Draw it on the muted fill the board gives the fixed email. */
    muted?: boolean;
};

/**
 * A value carried over from the invite: focusable and announced (`readOnly`,
 * not `disabled`), with its reason as a description a screen reader reads on
 * focus — a field that announces "read only" without saying why leaves the
 * invitee guessing whether they are stuck. The reason is visually hidden to
 * keep the card as quiet as the board drew it.
 */
function ReadOnlyField({
    id,
    label,
    value,
    reason,
    type = 'text',
    autoComplete,
    muted = false
}: ReadOnlyFieldProps) {
    const descriptionId = `${id}-description`;
    return (
        <Field className="min-w-0">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                type={type}
                value={value}
                readOnly
                autoComplete={autoComplete}
                aria-describedby={descriptionId}
                className={cn('truncate', muted && 'bg-muted/50')}
            />
            <p id={descriptionId} className="sr-only">
                {reason}
            </p>
        </Field>
    );
}
