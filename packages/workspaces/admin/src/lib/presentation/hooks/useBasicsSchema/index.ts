import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { Slug } from '../../../domain/slug';
import { DESCRIPTION_MAX, NAME_MAX } from '../../../domain/workspaceLimits';

/** Validation copy for the basics step, co-located with the schema. */
const messages = defineMessages({
    nameRequired: {
        id: 'workspaces.create.basics.nameRequired',
        defaultMessage: 'Workspace name is required.'
    },
    nameTooLong: {
        id: 'workspaces.create.basics.nameTooLong',
        defaultMessage: 'Name must be at most {max} characters.'
    },
    slugRequired: {
        id: 'workspaces.create.basics.slugRequired',
        defaultMessage: 'Slug is required.'
    },
    slugPattern: {
        id: 'workspaces.create.basics.slugPattern',
        defaultMessage: 'Use lowercase letters, numbers, and hyphens only.'
    },
    descriptionTooLong: {
        id: 'workspaces.create.basics.descriptionTooLong',
        defaultMessage: 'Description must be at most {max} characters.'
    }
});

/**
 * Builds the basics-step Zod schema with localized messages. Mirrors the
 * server `CreateWorkspaceDto` through the shared {@link NAME_MAX} /
 * {@link DESCRIPTION_MAX} constants (name required, ≤120; slug required, matching
 * the {@link Slug} value object's rule; description ≤2000). The slug shape check
 * delegates to the shared {@link Slug} VO so it can't drift from the availability
 * hook or the server. Rebuilt when the locale changes so the copy stays in sync
 * with the UI. Slug *availability* is checked separately by `useSlugAvailability`
 * — this only validates shape.
 */
export function useBasicsSchema() {
    const intl = useIntl();

    return useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .trim()
                    .min(1, {
                        message: intl.formatMessage(messages.nameRequired)
                    })
                    .max(NAME_MAX, {
                        message: intl.formatMessage(messages.nameTooLong, {
                            max: NAME_MAX
                        })
                    }),
                slug: z
                    .string()
                    .trim()
                    .min(1, {
                        message: intl.formatMessage(messages.slugRequired)
                    })
                    .refine((value) => Slug.isValid(value), {
                        message: intl.formatMessage(messages.slugPattern)
                    }),
                description: z
                    .string()
                    .trim()
                    .max(DESCRIPTION_MAX, {
                        message: intl.formatMessage(
                            messages.descriptionTooLong,
                            {
                                max: DESCRIPTION_MAX
                            }
                        )
                    })
            }),
        [intl]
    );
}
