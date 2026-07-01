import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Spinner,
    Textarea,
    toast,
    type AvatarColor
} from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';
import { useWorkspaceProfileSchema } from '../../hooks/useWorkspaceProfileSchema';
import { useUpdateWorkspace } from '../../api/useUpdateWorkspace';
import { ColorSwatchRow } from '../ColorSwatchRow';
import { WorkspaceAvatar } from '../WorkspaceAvatar';

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.general.title',
        defaultMessage: 'General'
    },
    description: {
        id: 'workspaces.settings.general.description',
        defaultMessage:
            'Your workspace name, description, and avatar color. These are visible to everyone with access.'
    },
    nameLabel: {
        id: 'workspaces.settings.general.nameLabel',
        defaultMessage: 'Name'
    },
    nameHint: {
        id: 'workspaces.settings.general.nameHint',
        defaultMessage: 'A short, recognizable name for this workspace.'
    },
    descriptionLabel: {
        id: 'workspaces.settings.general.descriptionLabel',
        defaultMessage: 'Description'
    },
    descriptionHint: {
        id: 'workspaces.settings.general.descriptionHint',
        defaultMessage: 'Optional. What this workspace is for.'
    },
    slugLabel: {
        id: 'workspaces.settings.general.slugLabel',
        defaultMessage: 'URL slug'
    },
    slugHint: {
        id: 'workspaces.settings.general.slugHint',
        defaultMessage:
            'The workspace’s stable identifier. It can’t be changed after creation.'
    },
    readOnly: {
        id: 'workspaces.settings.general.readOnly',
        defaultMessage:
            'You have read-only access. Ask an administrator to change these details.'
    },
    save: {
        id: 'workspaces.settings.general.save',
        defaultMessage: 'Save changes'
    },
    saving: {
        id: 'workspaces.settings.general.saving',
        defaultMessage: 'Saving…'
    },
    saved: {
        id: 'workspaces.settings.general.saved',
        defaultMessage: 'Workspace details saved.'
    },
    error: {
        id: 'workspaces.settings.general.error',
        defaultMessage: 'Couldn’t save your changes. Please try again.'
    }
});

/** Props for {@link WorkspaceGeneralSettings}. */
export type WorkspaceGeneralSettingsProps = {
    /** The workspace being edited. */
    workspace: Workspace;
    /** Whether the current user may edit (holds `workspaces:update`). */
    canUpdate: boolean;
};

/**
 * The General settings tab: edit the workspace name, description, and avatar
 * color. Name/description use TanStack Form + the localized
 * {@link useWorkspaceProfileSchema}; the color is a small piece of local state
 * (a radio row, not a text field). The slug is shown read-only (it's immutable).
 * When the user lacks `workspaces:update` the fields are disabled and the save
 * action is hidden.
 */
export function WorkspaceGeneralSettings({
    workspace,
    canUpdate
}: WorkspaceGeneralSettingsProps) {
    const intl = useIntl();
    const schema = useWorkspaceProfileSchema();
    const update = useUpdateWorkspace();
    const [color, setColor] = useState<AvatarColor>(workspace.color);
    const colorDirty = color !== workspace.color;

    const form = useForm({
        defaultValues: {
            name: workspace.name,
            description: workspace.description
        },
        validators: { onChange: schema },
        onSubmit: async ({ value }) => {
            try {
                await update.mutateAsync({
                    id: workspace.id,
                    name: value.name.trim(),
                    description: value.description.trim(),
                    color
                });
                // Re-baseline the form to the saved values so it reads clean
                // until the next edit; the color re-baselines when the
                // invalidated list refetches the workspace.
                form.reset(value);
                toast(intl.formatMessage(messages.saved));
            } catch {
                toast(intl.formatMessage(messages.error));
            }
        }
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <form
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    form.handleSubmit();
                }}
            >
                <CardContent>
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                        <form.Subscribe selector={(state) => state.values.name}>
                            {(name) => (
                                <div className="flex shrink-0 justify-center sm:pt-1">
                                    <WorkspaceAvatar
                                        className="size-16 text-lg"
                                        initials={initialsOf(name) || '—'}
                                        color={color}
                                    />
                                </div>
                            )}
                        </form.Subscribe>

                        <FieldGroup className="flex-1">
                            <form.Field name="name">
                                {(field) => {
                                    const invalid =
                                        field.state.meta.isTouched &&
                                        field.state.meta.errors.length > 0;
                                    return (
                                        <Field data-invalid={invalid}>
                                            <FieldLabel htmlFor="settings-name">
                                                {intl.formatMessage(
                                                    messages.nameLabel
                                                )}
                                            </FieldLabel>
                                            <Input
                                                id="settings-name"
                                                value={field.state.value}
                                                onChange={(event) =>
                                                    field.handleChange(
                                                        event.target.value
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                maxLength={NAME_MAX}
                                                disabled={!canUpdate}
                                                aria-invalid={invalid}
                                            />
                                            <FieldDescription>
                                                {intl.formatMessage(
                                                    messages.nameHint
                                                )}
                                            </FieldDescription>
                                            {invalid ? (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            ) : null}
                                        </Field>
                                    );
                                }}
                            </form.Field>

                            <form.Field name="description">
                                {(field) => {
                                    const invalid =
                                        field.state.meta.isTouched &&
                                        field.state.meta.errors.length > 0;
                                    return (
                                        <Field data-invalid={invalid}>
                                            <FieldLabel htmlFor="settings-description">
                                                {intl.formatMessage(
                                                    messages.descriptionLabel
                                                )}
                                            </FieldLabel>
                                            <Textarea
                                                id="settings-description"
                                                value={field.state.value}
                                                onChange={(event) =>
                                                    field.handleChange(
                                                        event.target.value
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                maxLength={DESCRIPTION_MAX}
                                                rows={3}
                                                disabled={!canUpdate}
                                                aria-invalid={invalid}
                                            />
                                            <FieldDescription>
                                                {intl.formatMessage(
                                                    messages.descriptionHint
                                                )}
                                            </FieldDescription>
                                            {invalid ? (
                                                <FieldError
                                                    errors={
                                                        field.state.meta.errors
                                                    }
                                                />
                                            ) : null}
                                        </Field>
                                    );
                                }}
                            </form.Field>

                            <ColorSwatchRow
                                value={color}
                                onChange={(next) => canUpdate && setColor(next)}
                            />

                            <Field>
                                <FieldLabel htmlFor="settings-slug">
                                    {intl.formatMessage(messages.slugLabel)}
                                </FieldLabel>
                                <Input
                                    id="settings-slug"
                                    value={workspace.slug}
                                    readOnly
                                    disabled
                                />
                                <FieldDescription>
                                    {intl.formatMessage(messages.slugHint)}
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </div>
                </CardContent>

                {canUpdate ? (
                    <CardFooter className="justify-end border-t pt-6">
                        <form.Subscribe
                            selector={(state) => ({
                                canSubmit: state.canSubmit,
                                isDirty: state.isDirty,
                                isSubmitting: state.isSubmitting
                            })}
                        >
                            {({ canSubmit, isDirty, isSubmitting }) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        !canSubmit ||
                                        (!isDirty && !colorDirty) ||
                                        isSubmitting
                                    }
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Spinner />
                                            {intl.formatMessage(messages.saving)}
                                        </>
                                    ) : (
                                        intl.formatMessage(messages.save)
                                    )}
                                </Button>
                            )}
                        </form.Subscribe>
                    </CardFooter>
                ) : (
                    <CardFooter className="border-t pt-6">
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.readOnly)}
                        </p>
                    </CardFooter>
                )}
            </form>
        </Card>
    );
}
