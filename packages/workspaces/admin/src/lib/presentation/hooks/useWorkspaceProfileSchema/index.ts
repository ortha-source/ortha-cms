import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';

/** Validation copy for the settings profile form, co-located with the schema. */
const messages = defineMessages({
    nameRequired: {
        id: 'workspaces.settings.general.nameRequired',
        defaultMessage: 'Workspace name is required.'
    },
    nameTooLong: {
        id: 'workspaces.settings.general.nameTooLong',
        defaultMessage: 'Name must be at most 100 characters.'
    },
    descriptionTooLong: {
        id: 'workspaces.settings.general.descriptionTooLong',
        defaultMessage: 'Description must be at most 500 characters.'
    }
});

/**
 * Builds the settings General-tab Zod schema with localized messages. Mirrors
 * the server `UpdateWorkspaceDto` (name required, ≤100; description ≤500). The
 * slug is intentionally absent — it's the workspace's immutable URL identifier
 * and isn't editable from settings. Rebuilt when the locale changes so the copy
 * stays in sync with the UI.
 */
export function useWorkspaceProfileSchema() {
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
                    .max(100, {
                        message: intl.formatMessage(messages.nameTooLong)
                    }),
                description: z.string().trim().max(500, {
                    message: intl.formatMessage(messages.descriptionTooLong)
                })
            }),
        [intl]
    );
}
