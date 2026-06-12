import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';

/** Validation copy for the basics step, co-located with the schema. */
const messages = defineMessages({
    nameRequired: {
        id: 'workspaces.create.basics.nameRequired',
        defaultMessage: 'Workspace name is required.'
    },
    nameTooLong: {
        id: 'workspaces.create.basics.nameTooLong',
        defaultMessage: 'Name must be at most 100 characters.'
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
        defaultMessage: 'Description must be at most 500 characters.'
    }
});

/**
 * Builds the basics-step Zod schema with localized messages. Mirrors the
 * server `CreateWorkspaceDto` (name required, ≤100; slug required, matching
 * `^[a-z0-9-]+$`; description ≤500). Rebuilt when the locale changes so the
 * copy stays in sync with the UI. Slug *availability* is checked separately by
 * `useSlugAvailability` — this only validates shape.
 */
export function useBasicsSchema() {
    const intl = useIntl();

    return useMemo(
        () =>
            z.object({
                name: z
                    .string()
                    .trim()
                    .min(1, { message: intl.formatMessage(messages.nameRequired) })
                    .max(100, {
                        message: intl.formatMessage(messages.nameTooLong)
                    }),
                slug: z
                    .string()
                    .trim()
                    .min(1, { message: intl.formatMessage(messages.slugRequired) })
                    .regex(/^[a-z0-9-]+$/, {
                        message: intl.formatMessage(messages.slugPattern)
                    }),
                description: z.string().trim().max(500, {
                    message: intl.formatMessage(messages.descriptionTooLong)
                })
            }),
        [intl]
    );
}
