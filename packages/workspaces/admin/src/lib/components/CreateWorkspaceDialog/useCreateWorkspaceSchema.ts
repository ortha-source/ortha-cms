import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { AVATAR_COLORS } from '@ortha-cms/design-system';

/** Intl descriptors for the create-workspace validation copy. */
const messages = defineMessages({
    nameRequired: {
        id: 'workspaces.create.nameRequired',
        defaultMessage: 'Name is required'
    },
    nameTooLong: {
        id: 'workspaces.create.nameTooLong',
        defaultMessage: 'Keep the name under 60 characters'
    },
    descriptionTooLong: {
        id: 'workspaces.create.descriptionTooLong',
        defaultMessage: 'Keep the description under 200 characters'
    }
});

/**
 * Builds the create-workspace Zod schema with localized validation copy.
 * Rebuilt when the active locale changes so messages stay in sync with the UI.
 */
export function useCreateWorkspaceSchema() {
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
                    .max(60, {
                        message: intl.formatMessage(messages.nameTooLong)
                    }),
                description: z
                    .string()
                    .trim()
                    .max(200, {
                        message: intl.formatMessage(messages.descriptionTooLong)
                    }),
                color: z.enum(AVATAR_COLORS)
            }),
        [intl]
    );
}
