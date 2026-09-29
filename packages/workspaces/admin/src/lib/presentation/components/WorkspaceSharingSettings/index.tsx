import { useId, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    ConfirmDialog,
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    Switch,
    toast
} from '@orthacms/design-system';
import type { Workspace } from '../../../domain/types/workspace';
import { useSetWorkspaceSharing } from '../../../application/useSetWorkspaceSharing';

const messages = defineMessages({
    title: {
        id: 'workspaces.settings.sharing.title',
        defaultMessage: 'Sharing'
    },
    description: {
        id: 'workspaces.settings.sharing.description',
        defaultMessage:
            'Let other workspaces link to records in this workspace.'
    },
    label: {
        id: 'workspaces.settings.sharing.label',
        defaultMessage: 'Shared workspace'
    },
    hint: {
        id: 'workspaces.settings.sharing.hint',
        defaultMessage:
            'Published records can be linked from any workspace that is granted the same content type. Drafts are never visible outside this workspace.'
    },
    confirmTitle: {
        id: 'workspaces.settings.sharing.confirmTitle',
        defaultMessage: 'Stop sharing?'
    },
    confirmBody: {
        id: 'workspaces.settings.sharing.confirmBody',
        defaultMessage:
            'Links from other workspaces will stop showing these records.'
    },
    confirmAction: {
        id: 'workspaces.settings.sharing.confirmAction',
        defaultMessage: 'Stop sharing'
    },
    cancel: {
        id: 'workspaces.settings.sharing.cancel',
        defaultMessage: 'Cancel'
    },
    shared: {
        id: 'workspaces.settings.sharing.shared',
        defaultMessage: 'Workspace is now shared.'
    },
    unshared: {
        id: 'workspaces.settings.sharing.unshared',
        defaultMessage: 'Workspace is no longer shared.'
    },
    error: {
        id: 'workspaces.settings.sharing.error',
        defaultMessage: 'Couldn’t change sharing. Please try again.'
    }
});

/** Props for {@link WorkspaceSharingSettings}. */
export type WorkspaceSharingSettingsProps = {
    /** The workspace being edited. */
    workspace: Workspace;
    /** Whether the current user may edit (holds `workspaces:update`). */
    canUpdate: boolean;
};

/**
 * The **Sharing** card on the General settings tab: one switch deciding
 * whether this workspace's published records can be linked from other
 * workspaces granted the same content type.
 *
 * Unlike the profile card above it, the switch applies on its own — there is
 * no Save: toggling PATCHes `isShared` immediately and reports the outcome as a
 * toast (announced through the `Toaster`'s live region). Turning sharing **on**
 * is additive and applies directly; turning it **off** makes other
 * workspaces' links stop resolving, so it confirms first. While the request is
 * in flight the switch shows the state being written and is disabled, so a
 * double toggle can't race two PATCHes. Gated by `workspaces:update`, like the
 * rest of the tab: a reader sees the current state on a disabled switch.
 */
export function WorkspaceSharingSettings({
    workspace,
    canUpdate
}: WorkspaceSharingSettingsProps) {
    const intl = useIntl();
    const switchId = useId();
    const hintId = useId();
    const sharing = useSetWorkspaceSharing();
    const [confirmingOff, setConfirmingOff] = useState(false);
    const switchRef = useRef<HTMLButtonElement>(null);

    // While a write is in flight, show the state being written rather than the
    // cached one — the switch shouldn't snap back under the user's pointer.
    const checked = sharing.isPending
        ? sharing.variables.isShared
        : workspace.isShared;

    const apply = async (isShared: boolean) => {
        try {
            await sharing.mutateAsync({ id: workspace.id, isShared });
            toast.success(
                intl.formatMessage(
                    isShared ? messages.shared : messages.unshared
                )
            );
        } catch {
            toast.error(intl.formatMessage(messages.error));
        } finally {
            setConfirmingOff(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle asChild>
                    <h2>{intl.formatMessage(messages.title)}</h2>
                </CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Field orientation="horizontal">
                    <FieldContent>
                        <FieldLabel htmlFor={switchId}>
                            {intl.formatMessage(messages.label)}
                        </FieldLabel>
                        <FieldDescription id={hintId}>
                            {intl.formatMessage(messages.hint)}
                        </FieldDescription>
                    </FieldContent>
                    <Switch
                        ref={switchRef}
                        id={switchId}
                        aria-describedby={hintId}
                        checked={checked}
                        disabled={!canUpdate || sharing.isPending}
                        onCheckedChange={(next) => {
                            if (next) {
                                apply(true);
                            } else {
                                setConfirmingOff(true);
                            }
                        }}
                    />
                </Field>
            </CardContent>

            <ConfirmDialog
                open={confirmingOff}
                onOpenChange={setConfirmingOff}
                title={intl.formatMessage(messages.confirmTitle)}
                description={intl.formatMessage(messages.confirmBody)}
                confirmLabel={intl.formatMessage(messages.confirmAction)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                confirmVariant="destructive"
                busy={sharing.isPending}
                // Radix's own restore lands on <body> here (the dialog opens
                // from the switch's change handler, not from a Trigger), so a
                // keyboard user would restart at the top of the page. Put focus
                // back on the switch that opened it — after a confirm too,
                // where it now reads the new state.
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    switchRef.current?.focus();
                }}
                onConfirm={() => apply(false)}
            />
        </Card>
    );
}
