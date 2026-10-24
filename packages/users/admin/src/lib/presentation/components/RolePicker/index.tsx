import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Badge,
    Label,
    RadioGroup,
    RadioGroupItem,
    cn
} from '@orthacms/design-system';
import type { MemberRole } from '../../../domain/types/member';

/** Intl descriptors for {@link RolePicker}, co-located with the component. */
const messages = defineMessages({
    adminName: { id: 'users.rolePicker.adminName', defaultMessage: 'Admin' },
    adminDesc: {
        id: 'users.rolePicker.adminDesc',
        defaultMessage:
            'Everything, including members, roles, tokens and webhooks.'
    },
    contributorName: {
        id: 'users.rolePicker.contributorName',
        defaultMessage: 'Contributor'
    },
    contributorDesc: {
        id: 'users.rolePicker.contributorDesc',
        defaultMessage:
            'Creates, edits and publishes content in their workspaces.'
    },
    viewerName: { id: 'users.rolePicker.viewerName', defaultMessage: 'Viewer' },
    viewerDesc: {
        id: 'users.rolePicker.viewerDesc',
        defaultMessage: 'Reads content in their workspaces. Changes nothing.'
    },
    current: { id: 'users.rolePicker.current', defaultMessage: 'Current' },
    group: { id: 'users.rolePicker.group', defaultMessage: 'Role' }
});

const ROLES: ReadonlyArray<{
    key: MemberRole;
    name: (typeof messages)[keyof typeof messages];
    desc: (typeof messages)[keyof typeof messages];
}> = [
    { key: 'admin', name: messages.adminName, desc: messages.adminDesc },
    {
        key: 'contributor',
        name: messages.contributorName,
        desc: messages.contributorDesc
    },
    { key: 'viewer', name: messages.viewerName, desc: messages.viewerDesc }
];

/** The localized name of a system role — the dialog's button and the invite summary. */
export const ROLE_NAME_MESSAGES = {
    admin: messages.adminName,
    contributor: messages.contributorName,
    viewer: messages.viewerName
} as const;

/**
 * Radio cards over the three assignable system roles, each with what it can
 * do, and a "Current" badge on the saved one. Controlled: the parent owns
 * `value` and decides what choosing means. Used by the invite sheet and the
 * role dialog.
 */
export function RolePicker({
    value,
    current,
    disabled = false,
    labelledBy,
    onChange
}: {
    /**
     * The selected role, or `null` for a member holding a custom role — no card
     * is then marked selected, rather than one being picked on their behalf.
     */
    value: MemberRole | null;
    /** The member's currently-saved role, badged as "Current". */
    current?: MemberRole | null;
    /** Disables selection (read-only, guarded, or in flight). */
    disabled?: boolean;
    /**
     * Id of a visible label naming the group. Without one the group names
     * itself "Role".
     */
    labelledBy?: string;
    /** Called with the newly-picked role. */
    onChange: (role: MemberRole) => void;
}) {
    const intl = useIntl();
    const idPrefix = useId();

    return (
        <RadioGroup
            value={value ?? undefined}
            onValueChange={(next) => onChange(next as MemberRole)}
            disabled={disabled}
            aria-labelledby={labelledBy}
            aria-label={
                labelledBy ? undefined : intl.formatMessage(messages.group)
            }
            className="gap-1.5"
        >
            {ROLES.map((role) => {
                const id = `${idPrefix}-${role.key}`;
                const selected = value === role.key;
                return (
                    <Label
                        key={role.key}
                        htmlFor={id}
                        className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 font-normal transition-colors',
                            selected
                                ? 'border-foreground ring-1 ring-foreground'
                                : 'hover:bg-muted/50',
                            disabled && 'cursor-not-allowed opacity-70'
                        )}
                    >
                        <RadioGroupItem
                            id={id}
                            value={role.key}
                            className="mt-0.5"
                        />
                        <span className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                                {intl.formatMessage(role.name)}
                                {current === role.key ? (
                                    <Badge size="xs" variant="muted">
                                        {intl.formatMessage(messages.current)}
                                    </Badge>
                                ) : null}
                            </span>
                            <span className="text-[13px] text-muted-foreground">
                                {intl.formatMessage(role.desc)}
                            </span>
                        </span>
                    </Label>
                );
            })}
        </RadioGroup>
    );
}
