import { defineMessages, useIntl } from 'react-intl';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Textarea
} from '@orthacms/design-system';
import { useBasicsSchema } from '../../../hooks/useBasicsSchema';
import type { UseSlugResult } from '../../../hooks/useSlug';
import type { WizardData } from '../../../../domain/types/wizard';
import { DESCRIPTION_MAX } from '../../../../domain/workspaceLimits';
import { ColorSwatchRow } from '../../ColorSwatchRow';
import { SlugField } from '../SlugField';

const messages = defineMessages({
    nameLabel: {
        id: 'workspaces.create.basics.nameLabel',
        defaultMessage: 'Workspace name'
    },
    required: {
        id: 'workspaces.create.basics.required',
        defaultMessage: 'required'
    },
    namePlaceholder: {
        id: 'workspaces.create.basics.namePlaceholder',
        defaultMessage: 'e.g. Marketing site'
    },
    colorLabel: {
        id: 'workspaces.create.basics.colourLabel',
        defaultMessage: 'Colour'
    },
    descriptionLabel: {
        id: 'workspaces.create.basics.descriptionLabel',
        defaultMessage: 'Description'
    },
    descriptionOptional: {
        id: 'workspaces.create.basics.descriptionOptionalHint',
        defaultMessage: '· optional'
    },
    descriptionPlaceholder: {
        id: 'workspaces.create.basics.descriptionPlaceholder',
        defaultMessage: 'What is this workspace for?'
    },
    counter: {
        id: 'workspaces.create.basics.counterOf',
        defaultMessage: '{count} / {max}'
    }
});

/** Props for {@link IdentityFields}. */
export type IdentityFieldsProps = {
    /** Current basics data. */
    data: WizardData;
    /** Merge a partial patch into the basics data. */
    update: (patch: Partial<WizardData>) => void;
    /** Slug controller (status + handlers) owned by the page. */
    slug: UseSlugResult;
};

/**
 * The basics step body: the name (the only required field), the address it
 * makes with availability inline, the colour, and an optional description
 * with its length. The live card beside the step shows them as people will
 * see them in the list.
 */
export function IdentityFields({ data, update, slug }: IdentityFieldsProps) {
    const intl = useIntl();
    const schema = useBasicsSchema();

    const parsed = schema.safeParse({
        name: data.name,
        slug: data.slug,
        description: data.description
    });
    const issueFor = (field: 'name' | 'slug' | 'description') =>
        parsed.success
            ? undefined
            : parsed.error.issues.find((i) => i.path[0] === field)?.message;

    // Only surface errors once a field has content, so the form doesn't shout
    // before the user has typed anything.
    const nameError = data.name.length > 0 ? issueFor('name') : undefined;
    const slugError = data.slug.length > 0 ? issueFor('slug') : undefined;
    const descriptionError = issueFor('description');

    return (
        <FieldGroup className="gap-5">
            <Field data-invalid={!!nameError}>
                <FieldLabel htmlFor="workspace-name">
                    {intl.formatMessage(messages.nameLabel)}
                    <span aria-hidden className="text-destructive">
                        *
                    </span>
                </FieldLabel>
                <Input
                    id="workspace-name"
                    value={data.name}
                    onChange={(event) => slug.onNameChange(event.target.value)}
                    placeholder={intl.formatMessage(messages.namePlaceholder)}
                    autoComplete="off"
                    required
                    aria-invalid={!!nameError}
                />
                {nameError ? (
                    <FieldError errors={[{ message: nameError }]} />
                ) : null}
            </Field>

            <SlugField
                value={data.slug}
                slugEdited={data.slugEdited}
                status={slug.status}
                onChange={slug.onSlugChange}
                onRegenerate={slug.regenerate}
                error={slugError}
            />

            <ColorSwatchRow
                label={intl.formatMessage(messages.colorLabel)}
                size="sm"
                value={data.color}
                onChange={(color) => update({ color })}
            />

            <Field data-invalid={!!descriptionError}>
                <FieldLabel htmlFor="workspace-description">
                    {intl.formatMessage(messages.descriptionLabel)}
                    <span className="text-xs font-normal text-muted-foreground">
                        {intl.formatMessage(messages.descriptionOptional)}
                    </span>
                </FieldLabel>
                <Textarea
                    id="workspace-description"
                    className="min-h-16 shadow-none"
                    value={data.description}
                    onChange={(event) =>
                        update({ description: event.target.value })
                    }
                    placeholder={intl.formatMessage(
                        messages.descriptionPlaceholder
                    )}
                    aria-invalid={!!descriptionError}
                />
                <div className="flex items-start justify-between gap-3">
                    {descriptionError ? (
                        <FieldError errors={[{ message: descriptionError }]} />
                    ) : (
                        <span />
                    )}
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {intl.formatMessage(messages.counter, {
                            count: data.description.length,
                            max: DESCRIPTION_MAX
                        })}
                    </span>
                </div>
            </Field>
        </FieldGroup>
    );
}
