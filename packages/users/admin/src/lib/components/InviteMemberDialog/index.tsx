import { useMemo, type RefObject } from 'react';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { HTTP_STATUS } from '@ortha-cms/utils-admin';
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
    Field,
    FieldGroup,
    FieldLabel,
    InputField,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner,
    toast
} from '@ortha-cms/design-system';
import { useInviteMember } from '../../api/useInviteMember';
import type { MemberRole } from '../../types/member';

/** Intl descriptors for {@link InviteMemberDialog}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.invite.title',
        defaultMessage: 'Invite a member'
    },
    description: {
        id: 'users.invite.description',
        defaultMessage:
            'They’ll receive an email with a link to join. The invite appears in the list until it’s accepted.'
    },
    emailLabel: {
        id: 'users.invite.emailLabel',
        defaultMessage: 'Email'
    },
    emailInvalid: {
        id: 'users.invite.emailInvalid',
        defaultMessage: 'Enter a valid email address'
    },
    nameLabel: {
        id: 'users.invite.nameLabel',
        defaultMessage: 'Name (optional)'
    },
    nameTooLong: {
        id: 'users.invite.nameTooLong',
        defaultMessage: 'Keep the name under 80 characters'
    },
    roleLabel: {
        id: 'users.invite.roleLabel',
        defaultMessage: 'Role'
    },
    roleAdmin: {
        id: 'users.invite.roleAdmin',
        defaultMessage: 'Admin'
    },
    roleContributor: {
        id: 'users.invite.roleContributor',
        defaultMessage: 'Contributor'
    },
    roleViewer: {
        id: 'users.invite.roleViewer',
        defaultMessage: 'Viewer'
    },
    cancel: {
        id: 'users.invite.cancel',
        defaultMessage: 'Cancel'
    },
    submit: {
        id: 'users.invite.submit',
        defaultMessage: 'Send invite'
    },
    submitting: {
        id: 'users.invite.submitting',
        defaultMessage: 'Sending invite…'
    },
    emailTaken: {
        id: 'users.invite.emailTaken',
        defaultMessage: 'A member with this email already exists.'
    },
    failed: {
        id: 'users.invite.failed',
        defaultMessage: 'Couldn’t send the invite. Please try again.'
    },
    sent: {
        id: 'users.invite.sent',
        defaultMessage: 'Invite sent to {email}'
    }
});

const ROLE_OPTIONS: MemberRole[] = ['admin', 'contributor', 'viewer'];

type InviteMemberDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Element to return focus to when the dialog closes. Set by the page to
     * the control that opened it, since a state-controlled dialog has no
     * Radix trigger to restore focus to on its own.
     */
    restoreFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * The invite-member modal: email, role, and an optional display name. Stays
 * open until the server accepts — a taken email surfaces inline (409), other
 * failures as an alert — and closes with a toast on success.
 */
export function InviteMemberDialog({
    open,
    onOpenChange,
    restoreFocusRef
}: InviteMemberDialogProps) {
    const intl = useIntl();
    const inviteMember = useInviteMember();

    const schema = useMemo(
        () =>
            z.object({
                email: z.email({
                    message: intl.formatMessage(messages.emailInvalid)
                }),
                name: z
                    .string()
                    .trim()
                    .max(80, {
                        message: intl.formatMessage(messages.nameTooLong)
                    }),
                role: z.enum(ROLE_OPTIONS)
            }),
        [intl]
    );

    const form = useForm({
        defaultValues: {
            email: '',
            name: '',
            role: 'viewer' as MemberRole
        },
        validators: { onChange: schema },
        onSubmit: async ({ value }) => {
            try {
                const created = await inviteMember.mutateAsync({
                    email: value.email,
                    role: value.role,
                    name: value.name.trim() || undefined
                });
                toast(
                    intl.formatMessage(messages.sent, { email: created.email })
                );
                onOpenChange(false);
                form.reset();
            } catch {
                // Kept open: the error banner below the fields explains, and
                // the user can correct the email and retry.
            }
        }
    });

    const roleLabel: Record<MemberRole, string> = {
        admin: intl.formatMessage(messages.roleAdmin),
        contributor: intl.formatMessage(messages.roleContributor),
        viewer: intl.formatMessage(messages.roleViewer)
    };

    const errorMessage = inviteMember.isError
        ? inviteMember.error.status === HTTP_STATUS.CONFLICT
            ? intl.formatMessage(messages.emailTaken)
            : intl.formatMessage(messages.failed)
        : null;

    const close = (next: boolean) => {
        onOpenChange(next);
        if (!next) {
            form.reset();
            inviteMember.reset();
        }
    };

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent
                onCloseAutoFocus={(event) => {
                    const trigger = restoreFocusRef?.current;
                    if (trigger) {
                        event.preventDefault();
                        trigger.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title)}
                    </DialogTitle>
                    <DialogDescription>
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <form
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        form.handleSubmit();
                    }}
                >
                    <FieldGroup>
                        <form.Field name="email">
                            {(field) => (
                                <InputField
                                    id="invite-email"
                                    type="email"
                                    label={intl.formatMessage(
                                        messages.emailLabel
                                    )}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    errors={field.state.meta.errors}
                                />
                            )}
                        </form.Field>

                        <form.Field name="name">
                            {(field) => (
                                <InputField
                                    id="invite-name"
                                    label={intl.formatMessage(
                                        messages.nameLabel
                                    )}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    errors={field.state.meta.errors}
                                />
                            )}
                        </form.Field>

                        <form.Field name="role">
                            {(field) => (
                                <Field>
                                    <FieldLabel htmlFor="invite-role">
                                        {intl.formatMessage(messages.roleLabel)}
                                    </FieldLabel>
                                    <Select
                                        value={field.state.value}
                                        onValueChange={(value) =>
                                            field.handleChange(
                                                value as MemberRole
                                            )
                                        }
                                    >
                                        <SelectTrigger id="invite-role">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                {ROLE_OPTIONS.map((role) => (
                                                    <SelectItem
                                                        key={role}
                                                        value={role}
                                                    >
                                                        {roleLabel[role]}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        </form.Field>
                    </FieldGroup>

                    {errorMessage ? (
                        <Alert variant="destructive" className="mt-4">
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    ) : null}

                    <DialogFooter className="mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            className="shadow-none"
                            onClick={() => close(false)}
                        >
                            {intl.formatMessage(messages.cancel)}
                        </Button>
                        <Button type="submit" disabled={inviteMember.isPending}>
                            {inviteMember.isPending ? (
                                <>
                                    <Spinner aria-hidden />
                                    <span className="sr-only">
                                        {intl.formatMessage(
                                            messages.submitting
                                        )}
                                    </span>
                                </>
                            ) : null}
                            {intl.formatMessage(messages.submit)}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
