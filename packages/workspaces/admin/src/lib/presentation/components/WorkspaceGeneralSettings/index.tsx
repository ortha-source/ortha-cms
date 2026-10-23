import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { Lock } from 'lucide-react';
import {
    Badge,
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    Spinner,
    Textarea,
    toast,
    type AvatarColor
} from '@orthacms/design-system';
import { PageActionsPortal } from '@orthacms/shell-admin';
import { initialsOf } from '@orthacms/utils-admin';
import type { Workspace } from '../../../domain/types/workspace';
import { useWorkspaceProfileSchema } from '../../hooks/useWorkspaceProfileSchema';
import { useUpdateWorkspace } from '../../../application/useUpdateWorkspace';
import { DESCRIPTION_MAX, NAME_MAX } from '../../../domain/workspaceLimits';
import { ColorSwatchRow } from '../ColorSwatchRow';
import { SettingsSection } from '../SettingsSection';
import { WorkspaceAvatar } from '../WorkspaceAvatar';
import { WorkspaceIdField } from './WorkspaceIdField';

const messages = defineMessages({
    identityTitle: {
        id: 'workspaces.settings.general.identityTitle',
        defaultMessage: 'Identity'
    },
    identityDescription: {
        id: 'workspaces.settings.general.identityDescription',
        defaultMessage: 'Shown in the sidebar, the switcher and on every card.'
    },
    addressTitle: {
        id: 'workspaces.settings.general.addressTitle',
        defaultMessage: 'Address and API'
    },
    addressDescription: {
        id: 'workspaces.settings.general.addressDescription',
        defaultMessage: 'Fixed when the workspace was created.'
    },
    changed: {
        id: 'workspaces.settings.general.changed',
        defaultMessage: 'Changed'
    },
    unsaved: {
        id: 'workspaces.settings.general.unsaved',
        defaultMessage: 'Unsaved changes'
    },
    discard: {
        id: 'workspaces.settings.general.discard',
        defaultMessage: 'Discard'
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
        defaultMessage: 'Optional. Shown on the workspace card.'
    },
    slugLabel: {
        id: 'workspaces.settings.general.slugLabel',
        defaultMessage: 'URL slug'
    },
    slugHint: {
        id: 'workspaces.settings.general.slugHint',
        defaultMessage:
            'Part of every link into this workspace. It can’t change, so links keep working.'
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
 * The General section's form: **Identity** (the avatar color with a preview
 * tile, the name, the description) and **Address and API** (the slug and the
 * workspace id — read-only, since neither can change). Name/description use
 * TanStack Form + the localized {@link useWorkspaceProfileSchema}; the color is
 * a small piece of local state (a radio row, not a text field).
 *
 * **Save lives in the top bar**, the way the entry editor's does: "● Unsaved
 * changes · Discard · Save changes" while the form holds edits, a disabled Save
 * when it doesn't. The button sits outside the `<form>` in the DOM, so it
 * submits it through the `form` attribute rather than by nesting. Without
 * `workspaces:update` the fields are disabled, Save is absent and a line says
 * why.
 */
export function WorkspaceGeneralSettings({
    workspace,
    canUpdate
}: WorkspaceGeneralSettingsProps) {
    const intl = useIntl();
    const formId = useId();
    const schema = useWorkspaceProfileSchema();
    const update = useUpdateWorkspace();
    const [color, setColor] = useState<AvatarColor>(workspace.color);
    // The last saved color — the color dirty baseline. It re-baselines on save
    // success (before the list refetches and remounts this keyed component) so
    // a color-only save clears the dirty state and can't be PATCHed twice.
    const [savedColor, setSavedColor] = useState<AvatarColor>(workspace.color);
    const colorDirty = color !== savedColor;

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
                // Re-baseline both the form and the color to the saved values so
                // the section reads clean immediately — before the invalidated
                // list refetches and remounts this component — preventing a
                // duplicate PATCH if Save is clicked again.
                form.reset(value);
                setSavedColor(color);
                toast.success(intl.formatMessage(messages.saved));
            } catch {
                toast.error(intl.formatMessage(messages.error));
            }
        }
    });

    const changedBadge = (
        <Badge variant="warning" size="xs" className="ml-auto">
            {intl.formatMessage(messages.changed)}
        </Badge>
    );

    return (
        <>
            <form
                id={formId}
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    form.handleSubmit();
                }}
            >
                <SettingsSection
                    id={`${formId}-identity`}
                    title={intl.formatMessage(messages.identityTitle)}
                    description={intl.formatMessage(
                        messages.identityDescription
                    )}
                >
                    <FieldGroup>
                        <form.Subscribe selector={(state) => state.values.name}>
                            {(name) => (
                                <ColorSwatchRow
                                    value={color}
                                    onChange={(next) =>
                                        canUpdate && setColor(next)
                                    }
                                    leading={
                                        <WorkspaceAvatar
                                            className="size-10 text-sm"
                                            initials={initialsOf(name) || '—'}
                                            color={color}
                                        />
                                    }
                                />
                            )}
                        </form.Subscribe>

                        <form.Field name="name">
                            {(field) => {
                                const invalid =
                                    field.state.meta.isTouched &&
                                    field.state.meta.errors.length > 0;
                                return (
                                    <Field data-invalid={invalid}>
                                        <FieldLabel
                                            htmlFor="settings-name"
                                            className="w-full"
                                        >
                                            {intl.formatMessage(
                                                messages.nameLabel
                                            )}
                                            {field.state.meta.isDirty
                                                ? changedBadge
                                                : null}
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
                                        {invalid ? (
                                            <FieldError
                                                errors={field.state.meta.errors}
                                            />
                                        ) : (
                                            <FieldDescription>
                                                {intl.formatMessage(
                                                    messages.nameHint
                                                )}
                                            </FieldDescription>
                                        )}
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
                                        <FieldLabel
                                            htmlFor="settings-description"
                                            className="w-full"
                                        >
                                            {intl.formatMessage(
                                                messages.descriptionLabel
                                            )}
                                            {field.state.meta.isDirty
                                                ? changedBadge
                                                : null}
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
                                        {invalid ? (
                                            <FieldError
                                                errors={field.state.meta.errors}
                                            />
                                        ) : (
                                            <FieldDescription>
                                                {intl.formatMessage(
                                                    messages.descriptionHint
                                                )}
                                            </FieldDescription>
                                        )}
                                    </Field>
                                );
                            }}
                        </form.Field>

                        {canUpdate ? null : (
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.readOnly)}
                            </p>
                        )}
                    </FieldGroup>
                </SettingsSection>
            </form>

            <SettingsSection
                id={`${formId}-address`}
                title={intl.formatMessage(messages.addressTitle)}
                description={intl.formatMessage(messages.addressDescription)}
            >
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="settings-slug">
                            {intl.formatMessage(messages.slugLabel)}
                        </FieldLabel>
                        {/* `readOnly` but NOT `disabled`, matching
                            `WorkspaceIdField` below: a disabled input can't be
                            focused, so the slug could be neither selected nor
                            copied by keyboard, and screen readers skip disabled
                            controls in browse mode. The lock says why it
                            doesn't take typing. */}
                        <InputGroup className="bg-muted">
                            <InputGroupAddon>
                                <Lock aria-hidden />
                            </InputGroupAddon>
                            <InputGroupInput
                                id="settings-slug"
                                value={workspace.slug}
                                readOnly
                                className="text-muted-foreground"
                            />
                        </InputGroup>
                        <FieldDescription>
                            {intl.formatMessage(messages.slugHint)}
                        </FieldDescription>
                    </Field>

                    <WorkspaceIdField workspaceId={workspace.id} />
                </FieldGroup>
            </SettingsSection>

            {canUpdate ? (
                <PageActionsPortal>
                    <form.Subscribe
                        selector={(state) => ({
                            canSubmit: state.canSubmit,
                            isDirty: state.isDirty,
                            isSubmitting: state.isSubmitting
                        })}
                    >
                        {({ canSubmit, isDirty, isSubmitting }) => {
                            const dirty = isDirty || colorDirty;
                            return (
                                <>
                                    {dirty ? (
                                        <>
                                            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-warning-soft-foreground">
                                                <span
                                                    aria-hidden
                                                    className="size-1.5 rounded-full bg-current"
                                                />
                                                {intl.formatMessage(
                                                    messages.unsaved
                                                )}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={isSubmitting}
                                                onClick={() => {
                                                    form.reset();
                                                    setColor(savedColor);
                                                }}
                                            >
                                                {intl.formatMessage(
                                                    messages.discard
                                                )}
                                            </Button>
                                        </>
                                    ) : null}
                                    <Button
                                        type="submit"
                                        form={formId}
                                        disabled={
                                            !canSubmit || !dirty || isSubmitting
                                        }
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Spinner />
                                                {intl.formatMessage(
                                                    messages.saving
                                                )}
                                            </>
                                        ) : (
                                            intl.formatMessage(messages.save)
                                        )}
                                    </Button>
                                </>
                            );
                        }}
                    </form.Subscribe>
                </PageActionsPortal>
            ) : null}
        </>
    );
}
