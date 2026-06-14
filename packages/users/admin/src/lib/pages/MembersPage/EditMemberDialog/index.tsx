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
    FieldDescription,
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
import { useUpdateMember } from '../../../api/useUpdateMember';
import type { Member, MemberRole } from '../../../types/member';

/** Intl descriptors for {@link EditMemberDialog}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.edit.title',
        defaultMessage: 'Edit member'
    },
    description: {
        id: 'users.edit.description',
        defaultMessage: 'Update {email}’s display name or role.'
    },
    nameLabel: {
        id: 'users.edit.nameLabel',
        defaultMessage: 'Name'
    },
    nameTooLong: {
        id: 'users.edit.nameTooLong',
        defaultMessage: 'Keep the name under 80 characters'
    },
    roleLabel: {
        id: 'users.edit.roleLabel',
        defaultMessage: 'Role'
    },
    roleAdmin: {
        id: 'users.edit.roleAdmin',
        defaultMessage: 'Admin'
    },
    roleContributor: {
        id: 'users.edit.roleContributor',
        defaultMessage: 'Contributor'
    },
    roleViewer: {
        id: 'users.edit.roleViewer',
        defaultMessage: 'Viewer'
    },
    lastAdmin: {
        id: 'users.edit.lastAdmin',
        defaultMessage:
            'This member is the last remaining admin, so their role can’t change. Promote another member to admin first.'
    },
    cancel: {
        id: 'users.edit.cancel',
        defaultMessage: 'Cancel'
    },
    submit: {
        id: 'users.edit.submit',
        defaultMessage: 'Save changes'
    },
    submitting: {
        id: 'users.edit.submitting',
        defaultMessage: 'Saving…'
    },
    conflict: {
        id: 'users.edit.conflict',
        defaultMessage:
            'The last remaining admin cannot be demoted. Promote another member to admin first.'
    },
    failed: {
        id: 'users.edit.failed',
        defaultMessage: 'Couldn’t save the changes. Please try again.'
    },
    saved: {
        id: 'users.edit.saved',
        defaultMessage: 'Saved changes to {name}'
    }
});

const ROLE_OPTIONS: MemberRole[] = ['admin', 'contributor', 'viewer'];

type EditMemberDialogProps = {
    /** The member being edited; `null` keeps the dialog closed. */
    member: Member | null;
    onOpenChange: (open: boolean) => void;
    /**
     * Element to return focus to when the dialog closes. The row menu that
     * opened it has already closed, so the page supplies a stable target.
     */
    restoreFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * The edit-member modal: display name and role. The role select locks for the
 * sole active admin (with the rationale shown inline); a 409 — a demotion
 * that raced past the guard — surfaces as an alert. Closes with a toast on
 * success.
 */
export function EditMemberDialog({
    member,
    onOpenChange,
    restoreFocusRef
}: EditMemberDialogProps) {
    const intl = useIntl();

    return (
        <Dialog open={member !== null} onOpenChange={onOpenChange}>
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
                        {intl.formatMessage(messages.description, {
                            email: member?.email ?? ''
                        })}
                    </DialogDescription>
                </DialogHeader>
                {member ? (
                    // Keyed per member so the form (whose default values are
                    // captured on mount) resets when a different row is edited.
                    <EditMemberForm
                        key={member.id}
                        member={member}
                        onClose={() => onOpenChange(false)}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

/** The dialog's body: the name/role form bound to one member. */
function EditMemberForm({
    member,
    onClose
}: {
    member: Member;
    onClose: () => void;
}) {
    const intl = useIntl();
    const updateMember = useUpdateMember();

    const schema = useMemo(
        () =>
            z.object({
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
            name: member.name,
            role: member.role
        },
        validators: { onChange: schema },
        onSubmit: async ({ value }) => {
            const trimmed = value.name.trim();
            try {
                const updated = await updateMember.mutateAsync({
                    id: member.id,
                    // Only send what changed; an empty name is "leave as is"
                    // (clearing a name back to null isn't supported).
                    name:
                        trimmed && trimmed !== member.name
                            ? trimmed
                            : undefined,
                    role: value.role !== member.role ? value.role : undefined
                });
                toast(
                    intl.formatMessage(messages.saved, { name: updated.name })
                );
                onClose();
            } catch {
                // Kept open: the error banner below the fields explains.
            }
        }
    });

    const roleLabel: Record<MemberRole, string> = {
        admin: intl.formatMessage(messages.roleAdmin),
        contributor: intl.formatMessage(messages.roleContributor),
        viewer: intl.formatMessage(messages.roleViewer)
    };

    const errorMessage = updateMember.isError
        ? updateMember.error.status === HTTP_STATUS.CONFLICT
            ? intl.formatMessage(messages.conflict)
            : intl.formatMessage(messages.failed)
        : null;

    return (
        <form
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                form.handleSubmit();
            }}
        >
            <FieldGroup>
                <form.Field name="name">
                    {(field) => (
                        <InputField
                            id="edit-member-name"
                            label={intl.formatMessage(messages.nameLabel)}
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
                            <FieldLabel htmlFor="edit-member-role">
                                {intl.formatMessage(messages.roleLabel)}
                            </FieldLabel>
                            <Select
                                value={field.state.value}
                                onValueChange={(value) =>
                                    field.handleChange(value as MemberRole)
                                }
                                disabled={member.isLastAdmin}
                            >
                                <SelectTrigger id="edit-member-role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {ROLE_OPTIONS.map((role) => (
                                            <SelectItem key={role} value={role}>
                                                {roleLabel[role]}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {member.isLastAdmin ? (
                                <FieldDescription>
                                    {intl.formatMessage(messages.lastAdmin)}
                                </FieldDescription>
                            ) : null}
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
                    onClick={onClose}
                >
                    {intl.formatMessage(messages.cancel)}
                </Button>
                <Button type="submit" disabled={updateMember.isPending}>
                    {updateMember.isPending ? (
                        <>
                            <Spinner aria-hidden />
                            <span className="sr-only">
                                {intl.formatMessage(messages.submitting)}
                            </span>
                        </>
                    ) : null}
                    {intl.formatMessage(messages.submit)}
                </Button>
            </DialogFooter>
        </form>
    );
}
