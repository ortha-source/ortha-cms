import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { WORKSPACES_CREATE } from '../../../domain/permissions';

/** Intl descriptors for {@link NewWorkspaceHomeAction}, co-located here. */
const messages = defineMessages({
    label: {
        id: 'workspaces.home.newWorkspace',
        defaultMessage: 'New workspace'
    }
});

/**
 * The home top bar's **New workspace** button — the dashboard's primary
 * action, for someone who may create one. Renders nothing otherwise: a
 * button that leads to a refusal is not an action.
 */
export function NewWorkspaceHomeAction() {
    const intl = useIntl();
    const canCreate = useHasPermission(WORKSPACES_CREATE);
    if (!canCreate) return null;
    return (
        <Button asChild size="sm">
            <Link to="/workspaces/new">
                <Plus aria-hidden />
                {intl.formatMessage(messages.label)}
            </Link>
        </Button>
    );
}
