import type { RefObject } from 'react';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { Check } from 'lucide-react';
import { useAuth } from '@ortha-cms/identity-admin';
import {
    AVATAR_COLORS,
    Button,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
    InputField,
    Textarea,
    avatarColorVar,
    cn,
    toast,
    type AvatarColor
} from '@ortha-cms/design-system';
import { useCreateWorkspace } from '../../api/useCreateWorkspace';
import { radioGroupKeydown } from '../../utils/radioGroupKeydown';
import { useCreateWorkspaceSchema } from './useCreateWorkspaceSchema';
import type { WorkspaceMember } from '../../types/workspace';

/** Intl descriptors for {@link CreateWorkspaceDialog}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'workspaces.create.title',
        defaultMessage: 'Create a workspace'
    },
    description: {
        id: 'workspaces.create.description',
        defaultMessage:
            'A workspace groups content, members, and plugins. You become its owner.'
    },
    nameLabel: {
        id: 'workspaces.create.nameLabel',
        defaultMessage: 'Name'
    },
    descriptionLabel: {
        id: 'workspaces.create.descriptionLabel',
        defaultMessage: 'Description'
    },
    descriptionHelp: {
        id: 'workspaces.create.descriptionHelp',
        defaultMessage: 'A short summary of what this workspace holds.'
    },
    colorLabel: {
        id: 'workspaces.create.colorLabel',
        defaultMessage: 'Color'
    },
    colorSwatch: {
        id: 'workspaces.create.colorSwatch',
        defaultMessage: 'Use the {color} accent'
    },
    cancel: {
        id: 'workspaces.create.cancel',
        defaultMessage: 'Cancel'
    },
    submit: {
        id: 'workspaces.create.submit',
        defaultMessage: 'Create workspace'
    },
    created: {
        id: 'workspaces.create.created',
        defaultMessage: 'Created “{name}”'
    },
    createFailed: {
        id: 'workspaces.create.failed',
        defaultMessage: 'Couldn’t create the workspace. Please try again.'
    }
});

/** Derives up-to-two-letter initials from a name. */
function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

type CreateWorkspaceDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Element to return focus to when the dialog closes. Set by the page to the
     * control that opened it, since a state-controlled dialog has no Radix
     * trigger to restore focus to on its own.
     */
    restoreFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * The create-workspace modal. Collects a name, optional description, and an
 * accent color, then optimistically adds the workspace and toasts on success.
 * The signed-in user becomes its owner and sole member.
 */
export function CreateWorkspaceDialog({
    open,
    onOpenChange,
    restoreFocusRef
}: CreateWorkspaceDialogProps) {
    const intl = useIntl();
    const { user } = useAuth();
    const schema = useCreateWorkspaceSchema();
    const createWorkspace = useCreateWorkspace();

    const form = useForm({
        defaultValues: {
            name: '',
            description: '',
            color: 'slate' as AvatarColor
        },
        validators: { onChange: schema },
        onSubmit: ({ value }) => {
            const displayName = user?.name ?? user?.email ?? '';
            const creator: WorkspaceMember = {
                id: user?.id ?? 'me',
                name: displayName,
                email: user?.email ?? '',
                initials: initialsOf(displayName || 'You'),
                color: value.color
            };

            // Optimistic + fire-and-forget: the card appears instantly (see
            // useCreateWorkspace) and the dialog closes right away. Success and
            // failure are both surfaced as toasts, since the dialog is already
            // gone by the time the mutation settles; on failure the optimistic
            // insert is rolled back by the mutation's own onError.
            createWorkspace.mutate(
                { ...value, creator },
                {
                    onSuccess: (created) => {
                        toast(
                            intl.formatMessage(messages.created, {
                                name: created.name
                            })
                        );
                    },
                    onError: () => {
                        toast.error(
                            intl.formatMessage(messages.createFailed)
                        );
                    }
                }
            );

            onOpenChange(false);
            form.reset();
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                        <form.Field name="name">
                            {(field) => (
                                <InputField
                                    id="workspace-name"
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

                        <form.Field name="description">
                            {(field) => (
                                <Field
                                    data-invalid={
                                        field.state.meta.errors.length > 0
                                    }
                                >
                                    <FieldLabel htmlFor="workspace-description">
                                        {intl.formatMessage(
                                            messages.descriptionLabel
                                        )}
                                    </FieldLabel>
                                    <Textarea
                                        id="workspace-description"
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value
                                            )
                                        }
                                        aria-invalid={
                                            field.state.meta.errors.length > 0
                                        }
                                    />
                                    <FieldDescription>
                                        {intl.formatMessage(
                                            messages.descriptionHelp
                                        )}
                                    </FieldDescription>
                                    {field.state.meta.errors.length > 0 ? (
                                        <FieldError
                                            errors={field.state.meta.errors}
                                        />
                                    ) : null}
                                </Field>
                            )}
                        </form.Field>

                        <form.Field name="color">
                            {(field) => (
                                <FieldSet>
                                    <FieldLegend variant="label">
                                        {intl.formatMessage(
                                            messages.colorLabel
                                        )}
                                    </FieldLegend>
                                    <div
                                        role="radiogroup"
                                        aria-label={intl.formatMessage(
                                            messages.colorLabel
                                        )}
                                        className="flex flex-wrap gap-2"
                                        onKeyDown={(event) =>
                                            radioGroupKeydown(
                                                event,
                                                AVATAR_COLORS,
                                                field.state.value,
                                                field.handleChange
                                            )
                                        }
                                    >
                                        {AVATAR_COLORS.map((color) => {
                                            const selected =
                                                field.state.value === color;
                                            return (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    tabIndex={selected ? 0 : -1}
                                                    aria-label={intl.formatMessage(
                                                        messages.colorSwatch,
                                                        { color }
                                                    )}
                                                    onClick={() =>
                                                        field.handleChange(
                                                            color
                                                        )
                                                    }
                                                    className={cn(
                                                        'flex size-9 items-center justify-center rounded-xl text-white transition',
                                                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                        selected &&
                                                            'ring-2 ring-ring ring-offset-2'
                                                    )}
                                                    style={{
                                                        backgroundColor:
                                                            avatarColorVar(
                                                                color
                                                            )
                                                    }}
                                                >
                                                    {selected ? (
                                                        <Check className="size-4" />
                                                    ) : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </FieldSet>
                            )}
                        </form.Field>
                    </FieldGroup>

                    <DialogFooter className="mt-6 gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                {intl.formatMessage(messages.cancel)}
                            </Button>
                        </DialogClose>
                        <form.Subscribe selector={(state) => state.canSubmit}>
                            {(canSubmit) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        !canSubmit || createWorkspace.isPending
                                    }
                                >
                                    {intl.formatMessage(messages.submit)}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
