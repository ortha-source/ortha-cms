import { useCallback, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { initialsOf } from '@orthacms/utils-admin';
import { toast } from '@orthacms/design-system';
import { Slug } from '../../domain/slug';
import type { WorkspaceMember } from '../../domain/types/workspace';
import type { InviteOutcome, WizardSnapshot } from '../../domain/types/wizard';
import { buildCreateWorkspaceBody } from '../../infrastructure/buildCreateWorkspaceBody';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import { isConflict } from '../../infrastructure/isConflict';
import { issueInvites } from '../issueInvites';
import { useCreateWorkspace } from '../useCreateWorkspace';

/**
 * The router state the wizard hands the "ready" screen: how each invitation
 * left. Absent after a reload, when the screen falls back to the pending
 * members it can see.
 */
export type WorkspaceReadyState = {
    /** One entry per invited address that became a pending account. */
    invites: InviteOutcome[];
};

/** Toast copy for the create-workspace use case. */
const messages = defineMessages({
    error: {
        id: 'workspaces.create.error',
        defaultMessage: 'Could not create workspace. Please try again.'
    },
    conflict: {
        id: 'workspaces.create.errorConflict',
        defaultMessage:
            'That address is already taken. Pick a different one on the Basics step.'
    },
    invalidSlug: {
        id: 'workspaces.create.errorInvalidSlug',
        defaultMessage:
            'That address isn’t valid. Use lowercase letters, numbers, and hyphens only.'
    }
});

/** What {@link useCreateWorkspaceFlow} returns. */
export type CreateWorkspaceFlow = {
    /**
     * Runs the create-workspace use case for a full wizard snapshot: validates
     * the slug through the {@link Slug} value object, derives the creator from
     * the session, POSTs via the create mutation (optimistic insert +
     * invalidation), issues the invitations of the addresses it invited, then
     * lands on the workspace's "ready" screen. Errors are caught and surfaced
     * as a toast, so the caller just awaits.
     */
    submit: (snapshot: WizardSnapshot) => Promise<void>;
    /** Whether a submission is currently in flight. */
    submitting: boolean;
};

/**
 * The create-workspace use-case hook. Orchestrates the multi-step wizard's
 * submission — slug VO validation → create → issue invitations → the "ready"
 * screen — so the wizard page stays layout + fields and owns none of the flow.
 * No success toast: the screen it lands on *is* the confirmation, and says
 * what to do next. Availability is enforced
 * by the page's continue gate; the {@link Slug} guard here is the last check
 * before the request.
 */
export function useCreateWorkspaceFlow(): CreateWorkspaceFlow {
    const intl = useIntl();
    const navigate = useNavigate();
    const auth = useAuth();
    const user = 'user' in auth ? auth.user : undefined;
    const createMutation = useCreateWorkspace();
    // Issuing an invitation is the users plugin's `users:create`; without it
    // the accounts still exist, pending, for someone who may send them.
    const canInvite = useHasPermission('users:create');
    // Covers the invitations as well as the create, so the button stays busy
    // until the screen changes.
    const [inFlight, setInFlight] = useState(false);

    const submit = useCallback(
        async (snapshot: WizardSnapshot): Promise<void> => {
            let slugGuarded = false;
            setInFlight(true);
            try {
                // Guard the shape through the domain VO before hitting the API.
                Slug.create(snapshot.data.slug.trim());
                slugGuarded = true;

                const displayName = user?.name ?? user?.email ?? 'You';
                const creator: WorkspaceMember = {
                    id: user?.id ?? 'me',
                    name: displayName,
                    email: user?.email ?? '',
                    initials: initialsOf(displayName),
                    color: snapshot.data.color,
                    pending: false
                };

                const created = await createMutation.mutateAsync({
                    body: buildCreateWorkspaceBody(snapshot),
                    creator
                });
                const invites = await issueInvites(
                    httpWorkspaceGateway,
                    created,
                    snapshot.members,
                    canInvite
                );
                const state: WorkspaceReadyState = { invites };
                navigate(`/workspaces/${created.id}/ready`, { state });
            } catch (error) {
                // Narrow the outcome rather than collapsing every failure onto
                // "Please try again" — for a taken slug that advice is actively
                // wrong, since retrying can never succeed. `isConflict` is the
                // same 409 narrowing the settings dialogs already use.
                if (!slugGuarded) {
                    toast.error(intl.formatMessage(messages.invalidSlug));
                } else if (isConflict(error)) {
                    toast.error(intl.formatMessage(messages.conflict));
                } else {
                    toast.error(intl.formatMessage(messages.error));
                }
            } finally {
                setInFlight(false);
            }
        },
        [user, createMutation, intl, navigate, canInvite]
    );

    return { submit, submitting: inFlight || createMutation.isPending };
}
