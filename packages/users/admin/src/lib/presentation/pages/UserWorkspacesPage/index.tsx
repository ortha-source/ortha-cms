import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Search } from 'lucide-react';
import {
    Button,
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    toast
} from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import { useAddToWorkspaces } from '../../../application/useAddToWorkspaces';
import { useRemoveWorkspaceMember } from '../../../application/useRemoveWorkspaceMember';
import { useUserDetailContext } from '../../userDetailContext';
import { AddToWorkspacesDialog } from '../../components/AddToWorkspacesDialog';
import { ConfirmDialog } from '@orthacms/design-system';
import { WorkspaceMembershipRow } from '../../components/WorkspaceMembershipRow';
import { MemberCard } from '../../components/MemberCard';
import type { MemberWorkspace } from '../../../domain/types/member';

/** Past this many memberships the list gets a search box. */
const SEARCH_FROM = 10;

/** Intl descriptors for {@link UserWorkspacesPage}. */
const messages = defineMessages({
    title: { id: 'users.workspaces.title', defaultMessage: 'Workspaces' },
    description: {
        id: 'users.workspaces.description',
        defaultMessage: 'The workspaces this member can access.'
    },
    add: { id: 'users.workspaces.add', defaultMessage: 'Add to workspace' },
    search: {
        id: 'users.workspaces.search',
        defaultMessage: 'Search this member’s workspaces'
    },
    noMatch: {
        id: 'users.workspaces.noMatch',
        defaultMessage: 'No workspaces match'
    },
    empty: {
        id: 'users.workspaces.empty',
        defaultMessage: 'This member isn’t in any workspace yet.'
    },
    confirmTitle: {
        id: 'users.workspaces.confirmTitle',
        defaultMessage: 'Remove from {name}?'
    },
    confirmBody: {
        id: 'users.workspaces.confirmBody',
        defaultMessage:
            'They’ll lose access to this workspace. You can add them back later.'
    },
    confirmRemove: {
        id: 'users.workspaces.confirmRemove',
        defaultMessage: 'Remove'
    },
    added: {
        id: 'users.workspaces.added',
        defaultMessage:
            'Added to {count, plural, one {# workspace} other {# workspaces}}.'
    },
    removed: {
        id: 'users.workspaces.removed',
        defaultMessage: 'Removed from {name}.'
    },
    addFailed: {
        id: 'users.workspaces.addFailed',
        defaultMessage: 'Couldn’t add to the workspaces. Please try again.'
    },
    removeFailed: {
        id: 'users.workspaces.removeFailed',
        defaultMessage: 'Couldn’t remove from the workspace. Please try again.'
    }
});

/**
 * The Workspaces tab: the member's memberships as one compact bordered list
 * (a row per workspace, Remove on the right, confirmed), a search box once
 * there are more than ten, and add (a multi-select dialog). Memberships come from
 * the shared detail record; mutations invalidate it so the list refreshes.
 * Editing requires `users:update`.
 */
export function UserWorkspacesPage() {
    const intl = useIntl();
    const { member } = useUserDetailContext();
    const canManage = useHasPermission('users:update');
    const addMember = useAddToWorkspaces(member.id);
    const removeMember = useRemoveWorkspaceMember();

    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState<MemberWorkspace | null>(null);
    const [query, setQuery] = useState('');

    const onAdd = async (workspaceIds: string[]) => {
        const { added, failed } = await addMember.add(workspaceIds);
        // Close once anything landed (the successful mutations have already
        // invalidated the detail, so the list reflects them); keep the dialog
        // open only when every add failed, so the admin can retry.
        if (added > 0) {
            setAdding(false);
            toast.success(intl.formatMessage(messages.added, { count: added }));
        }
        if (failed > 0) {
            toast.error(intl.formatMessage(messages.addFailed));
        }
    };

    const onRemove = () => {
        if (!removing) {
            return;
        }
        removeMember.mutate(
            { userId: member.id, workspaceId: removing.id },
            {
                onSuccess: () => {
                    toast.success(
                        intl.formatMessage(messages.removed, {
                            name: removing.name
                        })
                    );
                    setRemoving(null);
                },
                onError: () => {
                    toast.error(intl.formatMessage(messages.removeFailed));
                    setRemoving(null);
                }
            }
        );
    };

    const needle = query.trim().toLowerCase();
    const visible = needle
        ? member.workspaces.filter((workspace) =>
              workspace.name.toLowerCase().includes(needle)
          )
        : member.workspaces;

    return (
        <MemberCard
            title={intl.formatMessage(messages.title)}
            count={member.workspaces.length}
            action={
                canManage ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdding(true)}
                    >
                        <Plus aria-hidden className="size-4" />
                        {intl.formatMessage(messages.add)}
                    </Button>
                ) : null
            }
        >
            {member.workspaces.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <>
                    {member.workspaces.length > SEARCH_FROM ? (
                        <div className="border-b p-3">
                            <InputGroup className="shadow-none">
                                <InputGroupAddon>
                                    <Search />
                                </InputGroupAddon>
                                <InputGroupInput
                                    type="search"
                                    value={query}
                                    onChange={(event) =>
                                        setQuery(event.target.value)
                                    }
                                    aria-label={intl.formatMessage(
                                        messages.search
                                    )}
                                    placeholder={intl.formatMessage(
                                        messages.search
                                    )}
                                />
                            </InputGroup>
                        </div>
                    ) : null}
                    {visible.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                            {intl.formatMessage(messages.noMatch)}
                        </p>
                    ) : (
                        <ul
                            aria-label={intl.formatMessage(messages.title)}
                            className="divide-y"
                        >
                            {visible.map((workspace) => (
                                <WorkspaceMembershipRow
                                    key={workspace.id}
                                    workspace={workspace}
                                    onRemove={
                                        canManage ? setRemoving : undefined
                                    }
                                    removing={
                                        removeMember.isPending &&
                                        removing?.id === workspace.id
                                    }
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}

            <AddToWorkspacesDialog
                open={adding}
                onOpenChange={setAdding}
                existingIds={member.workspaces.map((workspace) => workspace.id)}
                busy={addMember.isPending}
                onAdd={onAdd}
            />

            <ConfirmDialog
                open={removing !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setRemoving(null);
                    }
                }}
                busy={removeMember.isPending}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: removing?.name ?? ''
                })}
                description={intl.formatMessage(messages.confirmBody)}
                confirmLabel={intl.formatMessage(messages.confirmRemove)}
                confirmVariant="destructive"
                onConfirm={onRemove}
            />
        </MemberCard>
    );
}
