import { useEffect, useId, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { TriangleAlert } from 'lucide-react';
import {
    Alert,
    AlertDescription,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Skeleton,
    Spinner,
    cn,
    toast
} from '@orthacms/design-system';
import { HTTP_STATUS } from '@orthacms/utils-admin';
import { useAuth, useHasPermission } from '@orthacms/identity-admin';
import { useRoleCatalog } from '../../../application/useRoleCatalog';
import { useUpdateMember } from '../../../application/useUpdateMember';
import { MemberEntity, type MemberBlockReason } from '../../../domain/member';
import {
    roleChanges,
    type RoleCapabilityId
} from '../../../domain/roleChanges';
import type { Member, MemberRole } from '../../../domain/types/member';
import { shortNameOf } from '../../memberNames';
import { RolePicker, ROLE_NAME_MESSAGES } from '../RolePicker';

/** Intl descriptors for {@link ChangeRoleDialog}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.roleDialog.title',
        defaultMessage: 'Change {name}’s role'
    },
    description: {
        id: 'users.roleDialog.description',
        defaultMessage:
            'One role across Ortha — it decides what they can do in every workspace they belong to.'
    },
    whatChanges: {
        id: 'users.roleDialog.whatChanges',
        defaultMessage: 'What changes'
    },
    now: { id: 'users.roleDialog.now', defaultMessage: 'Now' },
    yes: { id: 'users.roleDialog.yes', defaultMessage: 'Yes' },
    no: { id: 'users.roleDialog.no', defaultMessage: 'No' },
    editContent: {
        id: 'users.roleDialog.capability.editContent',
        defaultMessage: 'Edit and publish content'
    },
    manageMembers: {
        id: 'users.roleDialog.capability.manageMembers',
        defaultMessage: 'Manage members and roles'
    },
    tokensAndWebhooks: {
        id: 'users.roleDialog.capability.tokensAndWebhooks',
        defaultMessage: 'API tokens and webhooks'
    },
    manageWorkspaces: {
        id: 'users.roleDialog.capability.manageWorkspaces',
        defaultMessage: 'Create and configure workspaces'
    },
    catalogFailed: {
        id: 'users.roleDialog.catalogFailed',
        defaultMessage:
            'Couldn’t load what each role can do. You can still change the role.'
    },
    nextRequest: {
        id: 'users.roleDialog.nextRequest',
        defaultMessage:
            'Takes effect on {name}’s next request — no sign-out needed.'
    },
    self: {
        id: 'users.roleDialog.self',
        defaultMessage:
            'You can’t change your own role. Ask another admin to do it.'
    },
    lastAdmin: {
        id: 'users.roleDialog.lastAdmin',
        defaultMessage:
            '{name} is the last admin — make someone else admin first.'
    },
    customRole: {
        id: 'users.roleDialog.customRole',
        defaultMessage:
            '{name} holds the custom role “{roleName}”, which can’t be changed here without replacing it.'
    },
    cancel: { id: 'users.roleDialog.cancel', defaultMessage: 'Cancel' },
    confirm: {
        id: 'users.roleDialog.confirm',
        defaultMessage:
            '{role, select, admin {Make {name} an admin} contributor {Make {name} a contributor} other {Make {name} a viewer}}'
    },
    unchanged: {
        id: 'users.roleDialog.unchanged',
        defaultMessage: 'Keep {name} as {role}'
    },
    saved: {
        id: 'users.roleDialog.saved',
        defaultMessage:
            '{name} is now {role, select, admin {an admin} contributor {a contributor} other {a viewer}}.'
    },
    failed: {
        id: 'users.roleDialog.failed',
        defaultMessage: 'Couldn’t change the role. Please try again.'
    }
});

/** The reason copy for each guard the entity can raise. */
const BLOCK_MESSAGE: Record<
    MemberBlockReason,
    (typeof messages)[keyof typeof messages]
> = {
    self: messages.self,
    lastAdmin: messages.lastAdmin,
    customRole: messages.customRole
};

/** Server conflict codes the update can answer with, mapped to their reason. */
const CONFLICT_REASON: Record<string, MemberBlockReason> = {
    SELF_ACTION: 'self',
    LAST_ADMIN_PROTECTED: 'lastAdmin'
};

/** Row labels for the capabilities the table compares. */
const CAPABILITY_MESSAGE: Record<
    RoleCapabilityId,
    (typeof messages)[keyof typeof messages]
> = {
    editContent: messages.editContent,
    manageMembers: messages.manageMembers,
    tokensAndWebhooks: messages.tokensAndWebhooks,
    manageWorkspaces: messages.manageWorkspaces
};

/**
 * Change a member's role, showing **what changes** before it does: the three
 * role cards, then a table of the capabilities the current and the chosen role
 * hold, the rows that flip highlighted, and a button that names the outcome
 * ("Make Grace an admin") instead of a bare "Confirm".
 *
 * The table is computed from the server's own grants (`GET /api/users/roles`),
 * so it cannot describe a permission the guard does not enforce.
 *
 * The guards stay: your own role, the last admin and a custom role the cards
 * cannot represent all lock the cards and the button, with the reason written
 * underneath rather than in a hover-only tooltip. A server refusal that slips
 * past them (another admin demoted themselves a second ago) lands in the same
 * place.
 */
export function ChangeRoleDialog({
    member,
    open,
    onOpenChange,
    onChanged
}: {
    /** Whose role is changing. */
    member: Member;
    /** Whether the dialog is shown. */
    open: boolean;
    /** Open/close handler. */
    onOpenChange: (open: boolean) => void;
    /** Called after the server accepted the change. */
    onChanged?: (saved: Member) => void;
}) {
    const intl = useIntl();
    const { user } = useAuth();
    const canManage = useHasPermission('users:update');
    const update = useUpdateMember();
    const catalog = useRoleCatalog(open);
    const reasonId = useId();
    const [selected, setSelected] = useState<MemberRole | null>(member.role);
    const [refused, setRefused] = useState<MemberBlockReason | null>(null);

    // Every opening starts from the member's saved role, not from whatever the
    // previous opening left selected.
    useEffect(() => {
        if (open) {
            setSelected(member.role);
            setRefused(null);
        }
    }, [open, member.role]);

    const name = shortNameOf(member);
    const guard = MemberEntity.of(member).canChangeRole(user?.id);
    const blocked: MemberBlockReason | null =
        refused ?? (guard.ok ? null : guard.reason);
    const locked = !canManage || blocked !== null;
    const dirty = selected !== null && selected !== member.role;

    const grantsOf = (role: MemberRole | null) =>
        catalog.data?.find((entry) => entry.key === role)?.permissions;
    const currentGrants = grantsOf(member.role);
    const proposedGrants = grantsOf(selected);
    const rows =
        currentGrants && proposedGrants
            ? roleChanges(currentGrants, proposedGrants)
            : null;

    const apply = () => {
        if (!dirty || selected === null || locked) {
            return;
        }
        update.mutate(
            { id: member.id, role: selected },
            {
                onSuccess: (saved) => {
                    toast.success(
                        intl.formatMessage(messages.saved, {
                            name,
                            role: selected
                        })
                    );
                    onOpenChange(false);
                    onChanged?.(saved);
                },
                onError: (error) => {
                    const code =
                        error.status === HTTP_STATUS.CONFLICT
                            ? (error.details as { code?: string } | undefined)
                                  ?.code
                            : undefined;
                    const reason = code ? CONFLICT_REASON[code] : undefined;
                    if (reason) {
                        setRefused(reason);
                        return;
                    }
                    toast.error(intl.formatMessage(messages.failed));
                }
            }
        );
    };

    const yesNo = (value: boolean) => (
        <span
            className={cn(
                value ? 'text-success-soft-foreground' : 'text-muted-foreground'
            )}
        >
            {intl.formatMessage(value ? messages.yes : messages.no)}
        </span>
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!update.isPending) {
                    onOpenChange(next);
                }
            }}
        >
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>
                        {intl.formatMessage(messages.title, {
                            name: member.name
                        })}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {intl.formatMessage(messages.description)}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-w-0 flex-col gap-4">
                    <RolePicker
                        value={selected}
                        current={member.role}
                        disabled={locked || update.isPending}
                        onChange={setSelected}
                    />

                    {catalog.isPending ? (
                        <Skeleton className="h-36 w-full rounded-lg" />
                    ) : rows ? (
                        <div className="overflow-hidden rounded-lg border">
                            <table className="w-full text-sm">
                                <caption className="sr-only">
                                    {intl.formatMessage(messages.whatChanges)}
                                </caption>
                                <thead>
                                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                                        <th
                                            scope="col"
                                            className="px-3 py-2 font-medium"
                                        >
                                            {intl.formatMessage(
                                                messages.whatChanges
                                            )}
                                        </th>
                                        <th
                                            scope="col"
                                            className="w-20 px-3 py-2 font-medium"
                                        >
                                            {intl.formatMessage(messages.now)}
                                        </th>
                                        <th
                                            scope="col"
                                            className="w-28 px-3 py-2 font-medium"
                                        >
                                            {selected
                                                ? intl.formatMessage(
                                                      ROLE_NAME_MESSAGES[
                                                          selected
                                                      ]
                                                  )
                                                : null}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            data-changed={
                                                row.changed || undefined
                                            }
                                            className={cn(
                                                'border-b last:border-b-0',
                                                row.changed &&
                                                    'bg-warning-soft/60'
                                            )}
                                        >
                                            <th
                                                scope="row"
                                                className="px-3 py-2 text-left font-normal"
                                            >
                                                {intl.formatMessage(
                                                    CAPABILITY_MESSAGE[row.id]
                                                )}
                                            </th>
                                            <td className="px-3 py-2">
                                                {yesNo(row.before)}
                                            </td>
                                            <td className="px-3 py-2">
                                                {yesNo(row.after)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : catalog.isError ? (
                        <p className="text-sm text-muted-foreground">
                            {intl.formatMessage(messages.catalogFailed)}
                        </p>
                    ) : null}

                    {blocked ? (
                        <p
                            id={reasonId}
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            {intl.formatMessage(BLOCK_MESSAGE[blocked], {
                                name,
                                roleName: member.roleName
                            })}
                        </p>
                    ) : (
                        <Alert variant="warning" role="note">
                            <TriangleAlert aria-hidden />
                            <AlertDescription>
                                {intl.formatMessage(messages.nextRequest, {
                                    name
                                })}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={update.isPending}
                    >
                        {intl.formatMessage(messages.cancel)}
                    </Button>
                    <Button
                        onClick={apply}
                        disabled={locked || !dirty || update.isPending}
                        aria-describedby={blocked ? reasonId : undefined}
                    >
                        {update.isPending ? <Spinner aria-hidden /> : null}
                        {selected && dirty
                            ? intl.formatMessage(messages.confirm, {
                                  name,
                                  role: selected
                              })
                            : intl.formatMessage(messages.unchanged, {
                                  name,
                                  role: selected
                                      ? intl.formatMessage(
                                            ROLE_NAME_MESSAGES[selected]
                                        )
                                      : member.roleName
                              })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
