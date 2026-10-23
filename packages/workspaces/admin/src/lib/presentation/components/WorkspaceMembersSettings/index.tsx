import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useAuth } from '@orthacms/identity-admin';
import { ConfirmDialog, cn, toast } from '@orthacms/design-system';
import { useJustCreated } from '@orthacms/utils-admin';
import type {
    Workspace,
    WorkspaceMember
} from '../../../domain/types/workspace';
import type { DirectoryUser } from '../../../domain/types/wizard';
import { isConflict } from '../../../infrastructure/isConflict';
import {
    useAddWorkspaceMember,
    workspaceMembersScope
} from '../../../application/useAddWorkspaceMember';
import { useRemoveWorkspaceMember } from '../../../application/useRemoveWorkspaceMember';
import { MemberDirectorySearch } from './MemberDirectorySearch';
import { MemberListRow } from './MemberListRow';

const messages = defineMessages({
    rolesNote: {
        id: 'workspaces.settings.members.rolesNote',
        defaultMessage:
            'A person’s role is set once for the whole CMS, on their page under Members. The last member can’t be removed — a workspace with nobody in it can’t be opened.'
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
    lastMember: {
        id: 'workspaces.settings.members.lastMember',
        defaultMessage:
            'A workspace needs at least one member. Add someone else first, or delete the workspace.'
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
 * The Members settings section: a directory search over the roster (assign
 * existing users), then the roster as one framed list — avatar, name, "You" on
 * the signed-in person, email — and remove behind a confirmation. Roles are
 * not shown or changed here: a role is global, set on the person's page. Access is purely permission-based — every control is
 * gated on `workspaces:update`, and no member is special; without the permission
 * the roster is read-only.
 */
export function WorkspaceMembersSettings({
    workspace,
    canUpdate
}: WorkspaceMembersSettingsProps) {
    const intl = useIntl();
    const { user } = useAuth();
    const addMember = useAddWorkspaceMember();
    const removeMember = useRemoveWorkspaceMember();
    const isJustAdded = useJustCreated(workspaceMembersScope(workspace.id));
    const [pendingRemoval, setPendingRemoval] =
        useState<WorkspaceMember | null>(null);

    const rosterRef = useRef<HTMLUListElement>(null);
    const rosterLabelRef = useRef<HTMLSpanElement>(null);
    // Index whose Remove button focus should land on once the roster re-renders.
    const focusAfterRemoval = useRef<number | null>(null);
    // Which row opened the confirm dialog, so a dismissal can hand focus back.
    const dismissedId = useRef<string | null>(null);

    // Radix restores focus to the dialog's trigger on close — but the mutation
    // has just unmounted that trigger along with its row, so focus fell to
    // <body> and a keyboard user was dropped at the top of the document. Land on
    // the row that took its place instead, or the roster heading when the list
    // has emptied.
    useEffect(() => {
        const index = focusAfterRemoval.current;
        if (index === null) return;
        focusAfterRemoval.current = null;

        const buttons = rosterRef.current?.querySelectorAll<HTMLElement>(
            '[data-remove-member]'
        );
        const target = buttons?.length
            ? buttons[Math.min(index, buttons.length - 1)]
            : rosterLabelRef.current;
        target?.focus();
    }, [workspace.members]);

    const excludeIds = new Set(workspace.members.map((member) => member.id));

    const onSelect = async (user: DirectoryUser) => {
        try {
            await addMember.mutateAsync({
                workspaceId: workspace.id,
                userId: user.id
            });
            toast.success(
                intl.formatMessage(messages.added, { name: user.name })
            );
        } catch {
            toast.error(intl.formatMessage(messages.addError));
        }
    };

    const confirmRemoval = async () => {
        if (!pendingRemoval) return;
        const member = pendingRemoval;
        const removedIndex = workspace.members.findIndex(
            (candidate) => candidate.id === member.id
        );
        try {
            await removeMember.mutateAsync({
                workspaceId: workspace.id,
                userId: member.id
            });
            focusAfterRemoval.current = Math.max(0, removedIndex);
            toast.success(
                intl.formatMessage(messages.removed, { name: member.name })
            );
        } catch (error) {
            // The server answers 409 `LastMemberError` for the one member who
            // cannot go — a workspace with nobody in it is unreachable, so the
            // rule is absolute. "Please try again" is the one thing that will
            // never work here, and it is what every caller got: the catch was
            // blind to the status. Both sibling dialogs in this package already
            // narrow the same 409 (content revoke, workspace delete).
            (isConflict(error) ? toast.warning : toast.error)(
                intl.formatMessage(
                    isConflict(error)
                        ? messages.lastMember
                        : messages.removeError
                )
            );
        } finally {
            setPendingRemoval(null);
        }
    };

    return (
        <>
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

            <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center border-b bg-muted/40 px-4 py-2">
                    <span
                        ref={rosterLabelRef}
                        tabIndex={-1}
                        className="text-xs font-medium text-muted-foreground focus-visible:outline-none"
                    >
                        {intl.formatMessage(messages.rosterLabel, {
                            count: workspace.members.length
                        })}
                    </span>
                </div>
                <ul ref={rosterRef} className="divide-y">
                    {workspace.members.map((member) => (
                        <li
                            key={member.id}
                            className={cn(
                                isJustAdded(member.id) && 'ds-item-enter'
                            )}
                        >
                            <MemberListRow
                                // Both classes set `animation`, so the
                                // flash goes on the row inside the item.
                                className={cn(
                                    isJustAdded(member.id) && 'ds-flash'
                                )}
                                member={member}
                                isYou={member.id === user?.id}
                                canRemove={canUpdate}
                                onRemove={() => {
                                    dismissedId.current = member.id;
                                    setPendingRemoval(member);
                                }}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <p className="text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.rolesNote)}
            </p>

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
                onCloseAutoFocus={(event) => {
                    // Radix hands focus back to the `DialogTrigger` it holds in
                    // context — and this dialog has none, because it is opened
                    // from state rather than wrapped around a trigger. Its
                    // default therefore focuses nothing and a keyboard user is
                    // dropped on <body>, at the top of the document (WCAG
                    // 2.4.3). Aim at the row that opened it.
                    //
                    // Only on a dismissal: after a successful removal that row
                    // is gone, and the effect above has already claimed the
                    // slot that replaced it.
                    if (focusAfterRemoval.current !== null) return;
                    const button =
                        rosterRef.current?.querySelector<HTMLElement>(
                            `[data-remove-member][data-member-id="${dismissedId.current}"]`
                        );
                    if (!button) return;
                    event.preventDefault();
                    button.focus();
                }}
            />
        </>
    );
}
