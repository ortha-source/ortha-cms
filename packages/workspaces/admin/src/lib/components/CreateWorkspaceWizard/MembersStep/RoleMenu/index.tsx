import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { ChevronDown } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger
} from '@ortha-cms/design-system';
import type { AssignableRole } from '../../../../types/wizard';

const messages = defineMessages({
    adminLabel: {
        id: 'workspaces.create.members.roleAdminLabel',
        defaultMessage: 'Admin'
    },
    adminDescription: {
        id: 'workspaces.create.members.roleAdminDescription',
        defaultMessage: 'Manage content, members, and settings.'
    },
    editorLabel: {
        id: 'workspaces.create.members.roleEditorLabel',
        defaultMessage: 'Editor'
    },
    editorDescription: {
        id: 'workspaces.create.members.roleEditorDescription',
        defaultMessage: 'Create and edit content.'
    },
    viewerLabel: {
        id: 'workspaces.create.members.roleViewerLabel',
        defaultMessage: 'Viewer'
    },
    viewerDescription: {
        id: 'workspaces.create.members.roleViewerDescription',
        defaultMessage: 'Read-only access to content.'
    }
});

const ROLES: {
    value: AssignableRole;
    label: MessageDescriptor;
    description: MessageDescriptor;
}[] = [
    {
        value: 'admin',
        label: messages.adminLabel,
        description: messages.adminDescription
    },
    {
        value: 'editor',
        label: messages.editorLabel,
        description: messages.editorDescription
    },
    {
        value: 'viewer',
        label: messages.viewerLabel,
        description: messages.viewerDescription
    }
];

/** Props for {@link RoleMenu}. */
export type RoleMenuProps = {
    /** Current role. */
    role: AssignableRole;
    /** Called with the chosen role. */
    onChange: (role: AssignableRole) => void;
    /** Accessible name describing whose role this controls. */
    ariaLabel: string;
};

/** Dropdown that sets a member's role (Admin / Editor / Viewer). */
export function RoleMenu({ role, onChange, ariaLabel }: RoleMenuProps) {
    const intl = useIntl();
    const current = ROLES.find((r) => r.value === role) ?? ROLES[1];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={ariaLabel}
                >
                    {intl.formatMessage(current.label)}
                    <ChevronDown />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuRadioGroup
                    value={role}
                    onValueChange={(value) =>
                        onChange(value as AssignableRole)
                    }
                >
                    {ROLES.map((r) => (
                        <DropdownMenuRadioItem key={r.value} value={r.value}>
                            <div className="flex flex-col">
                                <span className="font-medium">
                                    {intl.formatMessage(r.label)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {intl.formatMessage(r.description)}
                                </span>
                            </div>
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
