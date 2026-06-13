import { useId, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Ban,
    CircleCheck,
    MoreHorizontal,
    Pencil,
    Send,
    Trash2
} from 'lucide-react';
import { useAuth, useHasPermission } from '@ortha-cms/identity-admin';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    cn,
    toast
} from '@ortha-cms/design-system';
import { useResendInvite } from '../../api/useResendInvite';
import { useRevokeInvite } from '../../api/useRevokeInvite';
import { useSetMemberStatus } from '../../api/useSetMemberStatus';
import type { Member } from '../../types/member';

/** Intl descriptors for {@link MemberRowActions}, co-located with the component. */
const messages = defineMessages({
    open: {
        id: 'users.actions.open',
        defaultMessage: 'Actions for {name}'
    },
    edit: {
        id: 'users.actions.edit',
        defaultMessage: 'Edit'
    },
    disable: {
        id: 'users.actions.disable',
        defaultMessage: 'Disable'
    },
    enable: {
        id: 'users.actions.enable',
        defaultMessage: 'Enable'
    },
    resend: {
        id: 'users.actions.resend',
        defaultMessage: 'Resend invite'
    },
    revoke: {
        id: 'users.actions.revoke',
        defaultMessage: 'Revoke invite'
    },
    disableSelf: {
        id: 'users.actions.disableSelf',
        defaultMessage: 'You cannot disable your own account.'
    },
    disableLastAdmin: {
        id: 'users.actions.disableLastAdmin',
        defaultMessage:
            'The last remaining admin cannot be disabled. Promote another member to admin first.'
    },
    disabled: {
        id: 'users.actions.disabled.toast',
        defaultMessage: 'Disabled {name}'
    },
    enabled: {
        id: 'users.actions.enabled.toast',
        defaultMessage: 'Enabled {name}'
    },
    resent: {
        id: 'users.actions.resent.toast',
        defaultMessage: 'Invite re-sent to {email}'
    },
    revoked: {
        id: 'users.actions.revoked.toast',
        defaultMessage: 'Revoked the invite for {email}'
    },
    actionFailed: {
        id: 'users.actions.failed.toast',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/**
 * The row-end kebab menu. Its items vary by the member's status — Invited:
 * resend / edit / revoke; Active: edit / disable; Disabled: edit / enable —
 * and each action is shown only when the signed-in user holds its `users:*`
 * permission. Guardrailed items (disabling yourself, disabling the sole
 * admin) stay visible but inert, with a tooltip explaining why. Renders
 * nothing when no action is available.
 */
export function MemberRowActions({
    member,
    onEdit
}: {
    member: Member;
    /** Opens the edit dialog for this member. */
    onEdit: (member: Member) => void;
}) {
    const intl = useIntl();
    const { user } = useAuth();
    const canUpdate = useHasPermission('users:update');
    const canInvite = useHasPermission('users:create');
    const canRevoke = useHasPermission('users:delete');

    const setStatus = useSetMemberStatus();
    const resendInvite = useResendInvite();
    const revokeInvite = useRevokeInvite();

    const failed = () => toast.error(intl.formatMessage(messages.actionFailed));

    const editItem = canUpdate ? (
        <DropdownMenuItem key="edit" onSelect={() => onEdit(member)}>
            <Pencil aria-hidden />
            {intl.formatMessage(messages.edit)}
        </DropdownMenuItem>
    ) : null;

    let items: ReactNode[] = [];
    let destructiveItem: ReactNode = null;

    if (member.status === 'pending') {
        items = [
            canInvite ? (
                <DropdownMenuItem
                    key="resend"
                    onSelect={() =>
                        resendInvite.mutate(member.id, {
                            onSuccess: () =>
                                toast(
                                    intl.formatMessage(messages.resent, {
                                        email: member.email
                                    })
                                ),
                            onError: failed
                        })
                    }
                >
                    <Send aria-hidden />
                    {intl.formatMessage(messages.resend)}
                </DropdownMenuItem>
            ) : null,
            editItem
        ];
        destructiveItem = canRevoke ? (
            <DropdownMenuItem
                key="revoke"
                className="text-destructive focus:text-destructive"
                onSelect={() =>
                    revokeInvite.mutate(member.id, {
                        onSuccess: () =>
                            toast(
                                intl.formatMessage(messages.revoked, {
                                    email: member.email
                                })
                            ),
                        onError: failed
                    })
                }
            >
                <Trash2 aria-hidden />
                {intl.formatMessage(messages.revoke)}
            </DropdownMenuItem>
        ) : null;
    } else if (member.status === 'active') {
        const disableBlockedReason =
            member.id === user?.id
                ? intl.formatMessage(messages.disableSelf)
                : member.isLastAdmin
                  ? intl.formatMessage(messages.disableLastAdmin)
                  : null;

        items = [
            editItem,
            canUpdate ? (
                <GuardedMenuItem
                    key="disable"
                    blockedReason={disableBlockedReason}
                    onSelect={() =>
                        setStatus.mutate(
                            { id: member.id, disabled: true },
                            {
                                onSuccess: () =>
                                    toast(
                                        intl.formatMessage(messages.disabled, {
                                            name: member.name
                                        })
                                    ),
                                onError: failed
                            }
                        )
                    }
                >
                    <Ban aria-hidden />
                    {intl.formatMessage(messages.disable)}
                </GuardedMenuItem>
            ) : null
        ];
    } else {
        items = [
            editItem,
            canUpdate ? (
                <DropdownMenuItem
                    key="enable"
                    onSelect={() =>
                        setStatus.mutate(
                            { id: member.id, disabled: false },
                            {
                                onSuccess: () =>
                                    toast(
                                        intl.formatMessage(messages.enabled, {
                                            name: member.name
                                        })
                                    ),
                                onError: failed
                            }
                        )
                    }
                >
                    <CircleCheck aria-hidden />
                    {intl.formatMessage(messages.enable)}
                </DropdownMenuItem>
            ) : null
        ];
    }

    const visibleItems = items.filter(Boolean);
    if (visibleItems.length === 0 && !destructiveItem) {
        return null;
    }

    // `modal={false}` so the open menu doesn't aria-hide the page root (which
    // holds focusable content) — a row menu needs no background trap.
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    id={`member-actions-${member.id}`}
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={intl.formatMessage(messages.open, {
                        name: member.name
                    })}
                >
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {visibleItems.length > 0 ? (
                    <DropdownMenuGroup>{visibleItems}</DropdownMenuGroup>
                ) : null}
                {visibleItems.length > 0 && destructiveItem ? (
                    <DropdownMenuSeparator />
                ) : null}
                {destructiveItem ? (
                    <DropdownMenuGroup>{destructiveItem}</DropdownMenuGroup>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * A menu item that a guardrail can veto. When `blockedReason` is set the item
 * stays visible but inert — styled disabled, `aria-disabled`, selection
 * suppressed — and a tooltip carries the reason. Radix's real `disabled`
 * suppresses the pointer/focus events tooltips need, hence the manual
 * treatment.
 */
function GuardedMenuItem({
    blockedReason,
    onSelect,
    children
}: {
    blockedReason: string | null;
    onSelect: () => void;
    children: ReactNode;
}) {
    const reasonId = useId();

    if (!blockedReason) {
        return (
            <DropdownMenuItem onSelect={onSelect}>{children}</DropdownMenuItem>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <DropdownMenuItem
                    aria-disabled
                    aria-describedby={reasonId}
                    className={cn('opacity-50 focus:bg-transparent')}
                    onSelect={(event) => event.preventDefault()}
                >
                    {children}
                    {/* Voiced as the item's description so a screen-reader user
                        hears why it's inert — the tooltip alone is visual. */}
                    <span id={reasonId} className="sr-only">
                        {blockedReason}
                    </span>
                </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">
                {blockedReason}
            </TooltipContent>
        </Tooltip>
    );
}
