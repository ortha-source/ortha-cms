import { useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { DESCRIPTION_MAX, NAME_MAX } from '../../../domain/workspaceLimits';

/** Validation copy for the settings profile form, co-located with the schema. */
const messages = defineMessages({
    nameRequired: {
        id: 'workspaces.settings.general.nameRequired',
        defaultMessage: 'Workspace name is required.'
    },
    nameTooLong: {
        id: 'workspaces.settings.general.nameTooLong',
        defaultMessage: 'Name must be at most {max} characters.'
    },
    descriptionTooLong: {
        id: 'workspaces.settings.general.descriptionTooLong',
        defaultMessage: 'Description must be at most {max} characters.'
    }
});

/**
 * Builds the settings General-tab Zod schema with localized messages. Mirrors
 * the server `UpdateWorkspaceDto` through the shared {@link NAME_MAX} /
 * {@link DESCRIPTION_MAX} constants (name required, ≤120; description ≤2000),
 * rather than restating the numbers here — which is how they previously drifted
 * to 100/500 and locked long-named workspaces out of the whole form. The slug is
 * intentionally absent — it's the workspace's immutable URL identifier and isn't
 * editable from settings. Rebuilt when the locale changes so the copy stays in
 * sync with the UI.
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
                    .max(NAME_MAX, {
                        message: intl.formatMessage(messages.nameTooLong, {
                            max: NAME_MAX
                        })
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
