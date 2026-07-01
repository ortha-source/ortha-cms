import { Fragment, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    ConfirmDialog,
    Separator,
    toast
} from '@ortha-cms/design-system';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import type { DirectoryUser } from '../../types/wizard';
import { useAddWorkspaceMember } from '../../api/useAddWorkspaceMember';
import { useRemoveWorkspaceMember } from '../../api/useRemoveWorkspaceMember';
import { MemberDirectorySearch } from './MemberDirectorySearch';
import { MemberListRow } from './MemberListRow';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.members.title',
        defaultMessage: 'Members'
    },
    description: {
        id: 'workspaces.settings.members.description',
        defaultMessage:
            'People with access to this workspace. A member’s permissions come from their global role, not from the workspace.'
    },
    rosterLabel: {
        id: 'workspaces.settings.members.rosterLabel',
        defaultMessage: '{count, plural, one {# member} other {# members}}'
    },
    readOnly: {
        id: 'workspaces.settings.members.readOnly',
        defaultMessage: 'You have read-only access and can’t change members.'
    },
    added: {
        id: 'workspaces.settings.members.added',
        defaultMessage: '{name} was added to the workspace.'
    },
    addError: {
        id: 'workspaces.settings.members.addError',
        defaultMessage: 'Couldn’t add that person. Please try again.'
    },
    removed: {
        id: 'workspaces.settings.members.removed',
        defaultMessage: '{name} was removed from the workspace.'
    },
    removeError: {
        id: 'workspaces.settings.members.removeError',
        defaultMessage: 'Couldn’t remove that member. Please try again.'
    },
    confirmTitle: {
        id: 'workspaces.settings.members.confirmTitle',
        defaultMessage: 'Remove member?'
    },
    confirmBody: {
        id: 'workspaces.settings.members.confirmBody',
        defaultMessage:
            '{name} will lose access to this workspace. They keep their account and global role, and you can add them back later.'
    },
    confirmAction: {
        id: 'workspaces.settings.members.confirmAction',
        defaultMessage: 'Remove'
    }
});

/** Props for {@link WorkspaceMembersSettings}. */
export type WorkspaceMembersSettingsProps = {
    /** The workspace whose members are managed. */
    workspace: Workspace;
    /** Whether the current user may manage members (holds `workspaces:update`). */
    canUpdate: boolean;
};

/**
 * The Members settings tab: assign existing directory users (the owner pinned
 * and un-removable) and remove members with a confirmation. All controls are
 * gated on `workspaces:update`; without it the roster is read-only.
 */
export function WorkspaceMembersSettings({
    workspace,
    canUpdate
}: WorkspaceMembersSettingsProps) {
    const intl = useIntl();
    const addMember = useAddWorkspaceMember();
    const removeMember = useRemoveWorkspaceMember();
    const [pendingRemoval, setPendingRemoval] = useState<WorkspaceMember | null>(
        null
    );

    const excludeIds = new Set(workspace.members.map((member) => member.id));

    const onSelect = async (user: DirectoryUser) => {
        try {
            await addMember.mutateAsync({
                workspaceId: workspace.id,
                userId: user.id
            });
            toast(intl.formatMessage(messages.added, { name: user.name }));
        } catch {
            toast(intl.formatMessage(messages.addError));
        }
    };

    const confirmRemoval = async () => {
        if (!pendingRemoval) return;
        const member = pendingRemoval;
        try {
            await removeMember.mutateAsync({
                workspaceId: workspace.id,
                userId: member.id
            });
            toast(intl.formatMessage(messages.removed, { name: member.name }));
        } catch {
            toast(intl.formatMessage(messages.removeError));
        } finally {
            setPendingRemoval(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {canUpdate ? (
                    <MemberDirectorySearch
                        excludeIds={excludeIds}
                        onSelect={onSelect}
                        busy={addMember.isPending}
                    />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.readOnly)}
                    </p>
                )}

                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                        {intl.formatMessage(messages.rosterLabel, {
                            count: workspace.members.length
                        })}
                    </span>
                    <div className="rounded-xl border">
                        {workspace.members.map((member, index) => (
                            <Fragment key={member.id}>
                                {index > 0 ? <Separator /> : null}
                                <MemberListRow
                                    member={member}
                                    isOwner={index === 0}
                                    canRemove={canUpdate}
                                    onRemove={() => setPendingRemoval(member)}
                                />
                            </Fragment>
                        ))}
                    </div>
                </div>
            </CardContent>

            <ConfirmDialog
                open={pendingRemoval !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingRemoval(null);
                }}
                title={intl.formatMessage(messages.confirmTitle)}
                description={intl.formatMessage(messages.confirmBody, {
                    name: pendingRemoval?.name ?? ''
                })}
                confirmLabel={intl.formatMessage(messages.confirmAction)}
                confirmVariant="destructive"
                busy={removeMember.isPending}
                onConfirm={confirmRemoval}
            />
        </Card>
    );
}
