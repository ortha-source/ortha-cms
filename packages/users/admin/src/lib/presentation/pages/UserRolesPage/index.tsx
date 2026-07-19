import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    toast
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useUpdateMember } from '../../../application/useUpdateMember';
import { useUserDetailContext } from '../../userDetailContext';
import { RolePicker } from '../../components/RolePicker';
import { ConfirmDialog } from '@ortha-cms/design-system';
import { MemberEntity } from '../../../domain/member';
import type { MemberRole } from '../../../domain/types/member';

/** Intl descriptors for {@link UserRolesPage}, co-located with the component. */
const messages = defineMessages({
    title: { id: 'users.roles.title', defaultMessage: 'Role' },
    description: {
        id: 'users.roles.description',
        defaultMessage: 'The member’s global role decides what they can do.'
    },
    note: {
        id: 'users.roles.note',
        defaultMessage:
            'Role changes take effect on their next request; existing sessions may keep the old permissions briefly.'
    },
    lastAdmin: {
        id: 'users.roles.lastAdmin',
        defaultMessage:
            'This member is the last remaining admin, so their role can’t change. Promote another member to admin first.'
    },
    apply: { id: 'users.roles.apply', defaultMessage: 'Apply role' },
    reset: { id: 'users.roles.reset', defaultMessage: 'Reset' },
    confirmTitle: {
        id: 'users.roles.confirmTitle',
        defaultMessage: 'Change {name}’s role?'
    },
    confirmBody: {
        id: 'users.roles.confirmBody',
        defaultMessage: 'They’ll get the {role} role’s permissions immediately.'
    },
    confirmAdminBody: {
        id: 'users.roles.confirmAdminBody',
        defaultMessage:
            'Admins have full access — they can manage members, roles, workspaces, and content. Continue?'
    },
    saved: {
        id: 'users.roles.saved',
        defaultMessage: 'Updated {name}’s role.'
    },
    failed: {
        id: 'users.roles.failed',
        defaultMessage: 'Couldn’t change the role. Please try again.'
    }
});

const ROLE_LABEL: Record<MemberRole, string> = {
    admin: 'Admin',
    contributor: 'Contributor',
    viewer: 'Viewer'
};

/**
 * The Role tab: pick the member's single global role and apply it behind a
 * confirm step (with an extra warning when escalating to Admin). The last
 * active admin can't be re-roled; the picker locks with the reason shown.
 * Requires `users:update`.
 */
export function UserRolesPage() {
    const intl = useIntl();
    const { member } = useUserDetailContext();
    const canManage = useHasPermission('users:update');
    const update = useUpdateMember();
    const [selected, setSelected] = useState<MemberRole>(member.role);
    const [confirming, setConfirming] = useState(false);

    // Mirror the server's guardrail: the sole active admin's role is locked.
    const roleChange = MemberEntity.of(member).canChangeRole();
    const locked = !canManage || !roleChange.ok;
    const dirty = selected !== member.role;

    const apply = () => {
        update.mutate(
            { id: member.id, role: selected },
            {
                onSuccess: (saved) => {
                    setConfirming(false);
                    setSelected(saved.role);
                    toast.success(
                        intl.formatMessage(messages.saved, { name: saved.name })
                    );
                },
                onError: () => {
                    setConfirming(false);
                    toast.error(intl.formatMessage(messages.failed));
                }
            }
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!roleChange.ok ? (
                    <Alert>
                        <AlertDescription>
                            {intl.formatMessage(messages.lastAdmin)}
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert>
                        <AlertDescription>
                            {intl.formatMessage(messages.note)}
                        </AlertDescription>
                    </Alert>
                )}
                <RolePicker
                    value={selected}
                    current={member.role}
                    disabled={locked}
                    onChange={setSelected}
                />
            </CardContent>
            {canManage ? (
                <CardFooter className="justify-end gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setSelected(member.role)}
                        disabled={!dirty || update.isPending}
                    >
                        {intl.formatMessage(messages.reset)}
                    </Button>
                    <Button
                        onClick={() => setConfirming(true)}
                        disabled={locked || !dirty || update.isPending}
                    >
                        {intl.formatMessage(messages.apply)}
                    </Button>
                </CardFooter>
            ) : null}

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                busy={update.isPending}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: member.name
                })}
                description={intl.formatMessage(
                    selected === 'admin'
                        ? messages.confirmAdminBody
                        : messages.confirmBody,
                    { role: ROLE_LABEL[selected] }
                )}
                confirmLabel={intl.formatMessage(messages.apply)}
                onConfirm={apply}
            />
        </Card>
    );
}
